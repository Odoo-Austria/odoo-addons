odoo.define('pos_rksv.screens', function (require) {
    "use strict";
    // This file contains the Screens definitions. Screens are the
    // content of the right pane of the pos, containing the main functionalities.
    //
    // Screens must be defined and named in chrome.js before use.
    //
    // Screens transitions are controlled by the Gui.
    //  gui.set_startup_screen() sets the screen displayed at startup
    //  gui.set_default_screen() sets the screen displayed for new orders
    //  gui.show_screen() shows a screen
    //  gui.back() goes to the previous screen
    //
    // Screen state is saved in the order. When a new order is selected,
    // a screen is displayed based on the state previously saved in the order.
    // this is also done in the Gui with:
    //  gui.show_saved_screen()
    //
    // All screens inherit from ScreenWidget. The only addition from the base widgets
    // are show() and hide() which shows and hides the screen but are also used to
    // bind and unbind actions on widgets and devices. The gui guarantees
    // that only one screen is shown at the same time and that show() is called after all
    // hide()s
    //
    // Each Screens must be independant from each other, and should have no
    // persistent state outside the models. Screen state variables are reset at
    // each screen display. A screen can be called with parameters, which are
    // to be used for the duration of the screen only.


    var screens = require('point_of_sale.screens');
    var core = require('web.core');
    var QWeb = core.qweb;
    var Model = require('web.DataModel');
    var gui = require('point_of_sale.gui');
    var _t = core._t;

    screens.PaymentScreenWidget.include({
        finalize_validation: function() {
            var self = this;
            var order = this.pos.get_order();

            if (order.is_paid_with_cash() && this.pos.config.iface_cashdrawer) {
                    this.pos.proxy.open_cashbox();
            }

            order.initialize_validation_date();

            if (order.is_to_invoice()) {
                var invoiced = this.pos.push_and_invoice_order(order);
                this.invoicing = true;

                invoiced.fail(function(error){
                    self.invoicing = false;
                    if (error.message === 'Missing Customer') {
                        self.gui.show_popup('confirm',{
                            'title': _t('Please select the Customer'),
                            'body': _t('You need to select the customer before you can invoice an order.'),
                            confirm: function(){
                                self.gui.show_screen('clientlist');
                            },
                        });
                    } else if (error.code < 0) {        // XmlHttpRequest Errors
                        self.gui.show_popup('error',{
                            'title': _t('The order could not be sent'),
                            'body': _t('Check your internet connection and try again.'),
                        });
                    } else if (error.code === 200) {    // OpenERP Server Errors
                        self.gui.show_popup('error-traceback',{
                            'title': error.data.message || _t("Server Error"),
                            'body': error.data.debug || _t('The server encountered an error while receiving your order.'),
                        });
                    } else {                            // ???
                        self.gui.show_popup('error',{
                            'title': _t("Unknown Error"),
                            'body':  _t("The order could not be sent to the server due to an unknown error"),
                        });
                    }
                });

                invoiced.done(function(){
                    self.invoicing = false;
                    self.gui.show_screen('receipt');
                });
            } else {
                this.pos.push_order(order).then(
                    function done(){
                        self.gui.show_screen('receipt');
                    },
                    function failed(message){
                        self.pos.gui.show_popup('error',{
                            'message': _t("RKSV Fehler"),
                            'comment':  message
                        });
                    }
                );
            }
        }
    });

    /*
     Do extend Receipt screen - we do not allow the receipt to not get printed !
     */
    screens.ReceiptScreenWidget.include({
        should_auto_print: function() {
            console.log("always print the receipt - no mercy here");
            return true;
        }
    });


    /*
     New Screen for RKSV related stuff
     Blocks all access to default pos until signature provider is correctly set
     */

    var RKSVStatusScreen = screens.ScreenWidget.extend({
        template: 'RKSVStatusScreen',
        sproviders: null,
        stay_open: false,
        active: false,

        init: function(parent, options){
            this._super(parent, options);
            this.events['click .close_pos'] = 'close_pos';
            this.events['click .close_rksv'] = 'manual_close';
            this.events['click .activate_cashbox'] = 'activate_cashbox';
            this.events['click .register_cashbox'] = 'register_cashbox';
        },
        start: function() {
            var self = this;
            console.log('RKSV: do install proxy status change handler');
            self.posbox_status_handler();
            console.log('RKSV: do install rk status change handler');
            self.rk_status_handler();
            console.log('RKSV: do install change handler on current signature');
            self.se_status_handler();
        },
        show: function() {
            var order = this.pos.get_order();
            if (order) {
                var params = order.get_screen_data('params');
                if ((params) && (params['stay_open'] === true)) {
                    this.stay_open = true;
                } else {
                    this.stay_open = false;
                }
            }
            var self = this;
            self.active = true;
            self._super();
            // Try to hide Everything else
            console.log('RKSV Status show');
            this.pos.gui.chrome.widget.order_selector.$('.orders').hide();
            this.pos.gui.chrome.widget.order_selector.$('.neworder-button').hide();
            this.pos.gui.chrome.widget.order_selector.$('.deleteorder-button').hide();

            /*
            Better Solution is needed
             */
            /*
            this.pos.gui.chrome.widget.username.hide();
            this.pos.gui.chrome.widget.close_button.hide();
            this.pos.gui.chrome.widget.notification.hide();
            this.pos.gui.chrome.widget.proxy_status.hide();
            this.pos.gui.chrome.widget.sale_details.hide();
            this.pos.gui.chrome.widget.signature.hide();
            if (this.pos.debug)
                this.pos.gui.chrome.widget.debug.hide();
            */
            // Do request new status from BMF on show
            var signature = self.pos.get('signature');
            // This will signal us the new status as soon as we get it
            self.pos.rksv.update_bmf_rk_status();
            if (signature)
                signature.try_refresh_status(self.pos);
            // Do render month product status
            self.render_month_product();
            // Do rerender signature providers
            self.render_sproviders();
        },
        hide: function() {
            // We avoid to hide here if not everything is ok - or emergency mode
            if ((!this.pos.rksv.all_ok()) && (!this.emergency_mode()))
                return;
            var self = this;
            self._super();
            self.active = false;

            // Enable the hidden elements
            console.log('RKSV Status hide');
            this.pos.gui.chrome.widget.order_selector.$('.orders').show();
            this.pos.gui.chrome.widget.order_selector.$('.neworder-button').show();
            this.pos.gui.chrome.widget.order_selector.$('.deleteorder-button').show();
            /*
            Better Solution is needed
             */
            /*
            this.pos.gui.chrome.widget.order_selector.show();
            this.pos.gui.chrome.widget.username.show();
            this.pos.gui.chrome.widget.close_button.show();
            this.pos.gui.chrome.widget.notification.show();
            this.pos.gui.chrome.widget.proxy_status.show();
            this.pos.gui.chrome.widget.sale_details.show();
            this.pos.gui.chrome.widget.signature.show();
            if (this.pos.debug)
                this.pos.gui.chrome.widget.debug.show();
            */
        },
        activate_cashbox: function() {
            this.pos.rksv.bmf_kasse_registrieren();
        },
        register_cashbox: function() {
            this.pos.rksv.register_cashbox();
        },
        manual_close: function() {
            // Clear the stay open flag
            this.stay_open = false;
            this.try_to_close();
        },
        emergency_mode: function() {
            var mode = this.pos.get('cashbox_mode');
            return (mode=='signature_failed' || mode=='posbox_failed');
        },
        auto_open_close: function() {
            if ((!this.active) && (!this.pos.rksv.all_ok()) && (!this.emergency_mode())) {
                this.pos.gui.show_screen('rksv_status');
            } else if ((this.active) && (!this.pos.rksv.all_ok()) && (!this.emergency_mode())) {
                // Already active - ok - stay active
            } else if ((this.active) && ((this.pos.rksv.all_ok()) || (this.emergency_mode()))) {
                // Active and everything is ok - or emergency mode - man - do try to close here
                this.try_to_close();
            }
        },
        try_to_close: function() {
            if (!this.active)
                return;
            // Is our current signature available ?
            if ((this.pos.rksv.all_ok() || this.emergency_mode()) && (!this.stay_open) && (!(this.pos.config.state === "setup" || this.pos.config.state === "failure" || this.pos.config.state === "inactive"))) {
                var order = this.pos.get_order();
                var previous = '';
                if (order) {
                    var previous = order.get_screen_data('previous-screen');
                    if ((!previous) || (previous == 'rksv_status')) {
                        this.pos.gui.show_screen(this.pos.gui.default_screen);
                    } else {
                        this.pos.gui.back();
                    }
                } else {
                    // if no selected order does exist - then there is no previous-screen - so activate default screen
                    this.pos.gui.show_screen(this.pos.gui.default_screen);
                }
            }
        },
        close_pos: function(){
            this.pos.gui.close();
        },
        render_month_product: function() {
            if (this.pos.rksv.statuses['rksv_products_exists']) {
                self.$('.monthproduct-status-indicator .indicator').css('background', 'green');
                self.$('.monthproduct-status-indicator .indicator-message').html("RKSV Produkte gefunden");
            } else {
                self.$('.monthproduct-status-indicator .indicator').css('background', 'red');
                self.$('.monthproduct-status-indicator .indicator-message').html("RKSV Produkte nicht gefunden !");
            }
        },
        se_status_handler: function() {
            var self = this;
            // Listen on status update for signaturs - display the change here
            this.pos.signatures.bind('add remove change', function(signature) {
                // Do rerender the sprovider view
                self.render_sproviders();
                console.log('signature change handler got called');
                if (!signature.isActive(self.pos))
                    // Ignore this update if it does not belong to the active signature
                    return;
                if ((signature.get('bmf_status')) && (signature.get('bmf_last_status')=='IN_BETRIEB')) {
                    self.$('.signature-provider-status-indicator .indicator').css('background', 'green');
                    self.$('.signature-provider-status-indicator .indicator-message').html("Angemeldet");
                } else {
                    self.$('.signature-provider-status-indicator .indicator').css('background', 'red');
                    self.$('.signature-provider-status-indicator .indicator-message').html(signature.get('bmf_last_status')+ ', ' + (signature.get('bmf_message')?signature.get('bmf_message'):''));
                }
                self.auto_open_close();
            });
        },
        rk_status_handler: function() {
            var self = this;
            // Listen on status update for kasse
            self.pos.bind('change:bmf_status_rk', function(pos, status) {
                self.$('.cashbox-message-box').html(status.message);
                //check rk  -needs to be registered with bmf
                if (status.success) {
                    self.$('.cashbox-status-indicator .indicator').css('background', 'green');
                    self.$('.cashbox-status-indicator .indicator-message').html(status.message);
                    self.$('.cashbox-status-indicator .activate_cashbox').hide();
                } else {
                    self.$('.cashbox-status-indicator .indicator').css('background', 'red');
                    self.$('.cashbox-status-indicator .indicator-message').html(status.message);
                    if (self.pos.rksv.bmf_auth_data()==true)
                        self.$('.cashbox-status-indicator .activate_cashbox').show();
                    else
                        self.$('.cashbox-status-indicator .activate_cashbox').hide();
                }
                // Button für Außerbetriebnahme einbauen !
                self.auto_open_close();
            });
            // Listen on state changes for the mode flag
            self.pos.bind('change:cashbox_mode', function (pos, state) {
                // Do rerender the sprovider view
                self.render_sproviders();
                self.auto_open_close();
            });
        },
        posbox_status_handler: function () {
            var self = this;
            this.pos.proxy.on('change:status', this, function (eh, status) {
                //this.pos.posbox_status = status.newValue.status;
                if (status.newValue.status == "connected") {
                    self.$('.posbox-status-indicator .indicator').css('background', 'green');
                    self.$('.posbox-status-indicator .indicator-message').html(status.newValue.status);
                } else {
                    self.$('.posbox-status-indicator .indicator').css('background', 'red');
                    self.$('.posbox-status-indicator .indicator-message').html(status.newValue.status);
                }
                // Check if we have to activate ourself
                if (status.newValue.status === 'connected' && (!(self.pos.config.state === "setup" || self.pos.config.state === "failure" || self.pos.config.state === "inactive"))) {
                    var rksvstatus = status.newValue.drivers.rksv ? status.newValue.drivers.rksv.status : false;
                    var rksvmessage = status.newValue.drivers.rksv && status.newValue.drivers.rksv.message ? status.newValue.drivers.rksv.message : false;
                    if (!rksvmessage) {
                        rksvmessage = "Status: " + status.newValue.drivers.rksv && status.newValue.drivers.rksv.status ? status.newValue.drivers.rksv.status : '?';
                    }
                    if (!rksvstatus) {
                        self.$('.rksv-status-indicator .indicator').css('background', 'red');
                        self.$('.rksv-status-indicator .indicator-message').html("Status unbekannt");
                        self.$('.rksv-status-indicator .register_cashbox').hide();
                    } else if (rksvstatus == 'connected') {
                        // Everything is correct
                        self.$('.rksv-status-indicator .indicator').css('background', 'green');
                        self.$('.rksv-status-indicator .indicator-message').html("PosBox Modul verbunden");
                        self.$('.rksv-status-indicator .register_cashbox').hide();
                    } else if (rksvstatus == 'doesnotexists') {
                        // Cashbox is not registered on this posbox !
                        self.$('.rksv-status-indicator .indicator').css('background', 'red');
                        self.$('.rksv-status-indicator .indicator-message').html("KassenID nicht auf dieser PosBox registriert !");
                        self.$('.rksv-status-indicator .register_cashbox').show();
                    } else {
                        // Only show it if it is not already in state visible !
                        self.$('.rksv-status-indicator .indicator').css('background', 'red');
                        self.$('.rksv-status-indicator .indicator-message').html(rksvmessage);
                        self.$('.rksv-status-indicator .register_cashbox').hide();
                    }
                } else if (status.newValue.status === 'connected' && (self.pos.config.state === "setup")) {
                    self.$('.rksv-status-indicator .indicator').css('background', 'red');
                    self.$('.rksv-status-indicator .indicator-message').html("Kasse befindet sich im Status Setup !");
                } else if (status.newValue.status === 'connected' && (self.pos.config.state === "failure")) {
                    self.$('.rksv-status-indicator .indicator').css('background', 'red');
                    self.$('.rksv-status-indicator .indicator-message').html("Kasse ist markiert als ausgefallen !");
                } else if (status.newValue.status === 'connected' && (self.pos.config.state === "inactive")) {
                    self.$('.rksv-status-indicator .indicator').css('background', 'red');
                    self.$('.rksv-status-indicator .indicator-message').html("Kasse ist deaktviert !");
                }
                self.auto_open_close();
            });
        },
        render_card: function (card) {
            var valid_vat = false;
            var company_vat = this.pos.company.vat;
            if (card.matchVAT(company_vat)) {
                valid_vat = true;
            }
            var sprovider_html = QWeb.render('SignatureProvider', {
                widget: this,
                card: card,
                valid_vat: valid_vat,
                signature: this.pos.get('signature')
            });
            return sprovider_html;
        },
        render_signature: function () {
            var signature = this.pos.get('signature');
            if (signature === null) {
                return "<b>Keine Signatur gesetzt!</b>";
            }
            var card = this.pos.signatures.getActiveSignature(this.pos);
            var signature_html = QWeb.render('CurrentSignature', {
                widget: this,
                signature: signature,
                pos: this.pos,
                card: (card?card:null)
            });
            return signature_html;
        },
        render_sproviders: function () {
            var self = this;
            self.$('.provider-container').empty();
            self.$('.provider-container').append(self.render_signature());
            var signatures = this.pos.signatures;
            if (!signatures) {
                return;
            }
            signatures.forEach(function(card) {
                self.$('.provider-container').append(self.render_card(card));
            });
            self.$el.find('.sprovider-btn').click(self, function (event) {
                var password = self.$el.find('#pass_input_signature').val();
                if (password == self.pos.config.pos_admin_passwd) {
                    self.pos.rksv.set_signature(event.target.value);
                } else {
                    self.pos.gui.show_popup('error',{
                        'message': _t("Passwort falsch"),
                        'comment': _t("Das richtige POS Admin Passwort wird benötigt.")
                    });
                }
                /*
                var provider_obj = new Model('signature.provider');
                var result = provider_obj.call('set_provider', [self.$el.find('#pass_input_signature').val(), event.target.value, {'pos_config_id': self.pos.config.id}]).then(
                    function done(result) {
                        if (!result['success']) {
                            self.$('.provider-message-box').empty();
                            self.$('.provider-message-box').append('<p style="color:red;">' + result['message'] + '</p>');
                        } else {
                            self.$('.provider-message-box').empty();
                            self.$('.provider-message-box').append('<p style="color:green;">' + result['message'] + '</p>');
                            location.reload();
                        }
                    }
                );
                */
            });
            self.$el.find('.rk-ausfall-se').click(self, function (event) {
                self.stay_open = false;
                self.pos.rksv.rk_ausfalls_modus();
            });
            self.$el.find('.sprovider-bmf-btn').click(self, function (event) {
                self.stay_open = false;
                self.pos.rksv.bmf_sprovider_registrieren(event.target.attributes['serial'].value);
            });
            self.$el.find('.sprovider-bmf-ausfall-btn').click(self, function (event) {
                self.stay_open = false;
                self.pos.rksv.bmf_sprovider_ausfall(event.target.attributes['serial'].value);
            });
            self.$el.find('.sprovider-bmf-wiederinbetriebnahme-btn').click(self, function (event) {
                self.stay_open = false;
                self.pos.rksv.bmf_sprovider_wiederinbetriebnahme(event.target.attributes['serial'].value);
            });
            self.$el.find('.sprovider-status-btn').click(self, function (event) {
                self.stay_open = false;
                self.pos.rksv.bmf_sprovider_status(event.target.attributes['serial'].value);
            });
            self.try_to_close();
        }
    });
    /*
    Main Blocking RKSV Status Popup Widget
     */
    gui.define_screen({name:'rksv_status', widget: RKSVStatusScreen});
});