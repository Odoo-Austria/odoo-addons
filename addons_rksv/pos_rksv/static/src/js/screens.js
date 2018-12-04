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
    var gui = require('point_of_sale.gui');
    var _t = core._t;

    screens.PaymentScreenWidget.include({
        // TODO: Implement this by splitting up and contributing to Odoo Core
        validate_order: function(force_validation) {
            if (!this.pos.config.iface_rksv)
                return this._super();
            var self = this;
            var order = this.pos.get_order();

            // Copied from finalize_validation
            // FIXME: this check is there because the backend is unable to
            // process empty orders. This is not the right place to fix it.
            if (order.get_orderlines().length === 0) {
                this.gui.show_popup('error',{
                    'title': _t('Empty Order'),
                    'body':  _t('There must be at least one product in your order before it can be validated'),
                });
                return;
            }

            var plines = order.get_paymentlines();
            for (var i = 0; i < plines.length; i++) {
                if (plines[i].get_type() === 'bank' && plines[i].get_amount() < 0) {
                    this.pos_widget.screen_selector.show_popup('error',{
                        'message': _t('Negative Bank Payment'),
                        'comment': _t('You cannot have a negative amount in a Bank payment. Use a cash payment method to return money to the customer.'),
                    });
                    return;
                }
            }

            if (!order.is_paid() || this.invoicing) {
                return;
            }

            // The exact amount must be paid if there is no cash payment method defined.
            if (Math.abs(order.get_total_with_tax() - order.get_total_paid()) > 0.00001) {
                var cash = false;
                for (var i = 0; i < this.pos.cashregisters.length; i++) {
                    cash = cash || (this.pos.cashregisters[i].journal.type === 'cash');
                }
                if (!cash) {
                    this.gui.show_popup('error',{
                        title: _t('Cannot return change without a cash payment method'),
                        body:  _t('There is no cash payment method available in this point of sale to handle the change.\n\n Please pay the exact amount or add a cash payment method in the point of sale configuration'),
                    });
                    return;
                }
            }

            // if the change is too large, it's probably an input error, make the user confirm.
            if (!force_validation && (order.get_total_with_tax() * 1000 < order.get_total_paid())) {
                this.gui.show_popup('confirm',{
                    title: _t('Please Confirm Large Amount'),
                    body:  _t('Are you sure that the customer wants to  pay') +
                           ' ' +
                           this.format_currency(order.get_total_paid()) +
                           ' ' +
                           _t('for an order of') +
                           ' ' +
                           this.format_currency(order.get_total_with_tax()) +
                           ' ' +
                           _t('? Clicking "Confirm" will validate the payment.'),
                    confirm: function() {
                        self.validate_order('confirm');
                    },
                });
                return;
            }

            if (order.is_paid_with_cash() && this.pos.config.iface_cashdrawer) {
                    this.pos.proxy.open_cashbox();
            }

            order.initialize_validation_date();
            var deferred = jQuery.Deferred();
            self.pos.rksv.rksv_wait();

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
		                // Set the push to rksv flag back
		                self.pos.rksv.rksv_done();
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

                    self.pos_widget.action_bar.set_button_disabled('validation',false);
                    self.pos_widget.action_bar.set_button_disabled('invoice',false);
                    deferred.reject();
                });

                invoiced.done(function(){
                    self.invoicing = false;
                    self.gui.show_screen('receipt');
                    self.pos.rksv.rksv_done();

                    self.pos_widget.screen_selector.set_current_screen(self.next_screen);
                    deferred.resolve();
                });
            } else {
                this.pos.push_order(order).then(
                    function done(){
                        self.gui.show_screen('receipt');
                        self.pos.rksv.rksv_done();
                        console.log('RKSV has done its job - we have signed the order');

                        self.pos_widget.screen_selector.set_current_screen(self.next_screen);
                        deferred.resolve();

                    },
                    function failed(message){
                        self.pos.rksv.rksv_done();
                        self.pos.gui.show_popup('error',{
                            'message': _t("RKSV Fehler"),
                            'comment':  message
                        });
                        deferred.reject();
                    }
                );
            }

            // hide onscreen (iOS) keyboard 
            setTimeout(function(){
                document.activeElement.blur();
                $("input").blur();
            },250);

            return deferred;
        },
        start: function() {
			var self = this;
			this._super();
			// do bind on proxy status change - disable action bar when we lose proxy connection
			this.pos.proxy.on('change:status', this, function (eh, status) {
				if (!self.pos.rksv.all_ok()) {
					this.$('.next').hide();
				} else {
				    this.$('.next').show();
				}
			});
        }
    });

    /*
     Do extend Receipt screen - we do not allow the receipt to not get printed !
     */
    screens.ReceiptScreenWidget.include({
        handle_auto_print: function() {
           console.log('I WANT TO PRINT LATER')
           var self = this
           setTimeout(function(){
                if (self.should_auto_print()) {
                    self.print();
                    if (self.should_close_immediately()){
                        self.click_next();
                    }
                } else {
                    self.lock_screen(false);
                }
            }, 1000);
        },
        show: function() {
            var self = this;
            if(self.pos.config.iface_print_via_proxy){
                self.print_proxy();
            }
            this._super();
        },
        should_auto_print: function() {
            if (!this.pos.config.iface_rksv)
                return this._super();
            console.log("We always must print the receipt");
            return true && !this.pos.get_order()._printed;
        },
        print_proxy: function() {
            var order = this.pos.get_order();
            var env = {
                widget:  this,
                order: order,
                receipt: order.export_for_printing(),
                paymentlines: order.get_paymentlines()
            };
            this.pos.proxy.print_receipt(QWeb.render('XmlReceipt',env));
        },
        print: function() {
           var self = this;
           self.print_web_delayed = this._super;
           setTimeout(function() {
               self.print_web_delayed();
           }, 1000);
        },
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
            this.events['click .revalidate_startreceipt'] = 'revalidate_startreceipt';
            this.events['click .delete_startreceipt'] = 'delete_startreceipt';
            this.events['click .export_crypt'] = 'export_crypt';
            this.events['click .start_receipt_set_valid'] = 'start_receipt_set_valid';
        },
        willStart: function() {
            if (this.pos.config.iface_rksv)
                return $.when();
            else
                // We do provide a deferred which will never fire
                return $.Deferred();
        },
        start: function() {
            if (!this.pos.config.iface_rksv)
                // Do nothing if rksv is not enabled
                return;
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

            // Only request current status if there is an connection available
            if (self.pos.rksv.check_proxy_connection()) {
                // Do request the current RK Status
                self.pos.rksv.update_bmf_rk_status();
                // Do request new status from BMF on show
                var signature = self.pos.get('signature');
                // This will signal us the new status as soon as we get it
                if (signature)
                    signature.try_refresh_status(self.pos);
            }
            // Do render month product status
            self.render_month_product();
            // Do rerender signature providers
            self.render_sproviders();
        },
        hide: function() {
            // We avoid to hide here if not everything is ok - or emergency mode
            if (this.pos.rksv === undefined || (!this.pos.rksv.all_ok()) && (!this.emergency_mode()))
                return;
            var self = this;
            self._super();
            self.active = false;

            // Enable the hidden elements
            console.log('RKSV Status hide');
            this.pos.gui.chrome.widget.order_selector.$('.orders').show();
            this.pos.gui.chrome.widget.order_selector.$('.neworder-button').show();
            this.pos.gui.chrome.widget.order_selector.$('.deleteorder-button').show();
        },
        activate_cashbox: function() {
            this.pos.rksv.bmf_kasse_registrieren();
        },
        register_cashbox: function() {
            this.pos.rksv.register_cashbox();
        },
        revalidate_startreceipt: function() {
            this.pos.rksv.bmf_register_start_receipt();
        },
        export_crypt: function() {
            this.pos.rksv.rksv_write_dep_crypt_container();
        },
        delete_startreceipt: function() {
            this.pos.rksv.delete_start_receipt();
        },
        start_receipt_set_valid: function() {
            this.pos.rksv.start_receipt_set_valid();
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
            // Do not open when rksv is not enabled
            if (!this.pos.config.iface_rksv) return;
            // Do not open when rksv is not intitialized
            if (this.pos.rksv === undefined) return;
            // Open Status widget on:
            // - Not already active
            // - Not all is ok - or we need a automatic receipt
            // - Not in emergency mode
            // - Do not open on only WLAN lost
            if ((!this.active) && ((!this.pos.rksv.all_ok()) || (this.pos.rksv.auto_receipt_needed())) && (!this.emergency_mode()) && (!this.pos.rksv.lost_wlan())) {
                this.pos.gui.show_screen('rksv_status');
            } else if ((this.active) && (!this.pos.rksv.all_ok()) && (!this.emergency_mode())) {
                // Already active - ok - stay active
            } else if ((this.active) && ((this.pos.rksv.all_ok()) || (this.emergency_mode())) && (!this.pos.rksv.auto_receipt_needed())) {
                // Active and everything is ok - or emergency mode - man - do try to close here
                this.try_to_close();
            }
        },
        try_to_close: function() {
            if (!this.active)
                return;
            // Is our current signature available?
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
                    // if no selected order does exist - then there is no previous-screen - so activate startup screen
                    this.pos.gui.show_screen(this.pos.gui.startup_screen);
                }
            }
        },
        close_pos: function(){
            this.pos.gui.close();
        },
        get_rksv_product: function(ul, tuple, type){
            var self = this;
            var product = false;
            if (tuple && (self.pos.db.get_product_by_id(tuple[0]))){
                product = self.pos.db.get_product_by_id(tuple[0]);
                ul.append('<li>Produkt (' + type + '): ' + product.display_name + ' (' + product.id + ')</li>');
            }
            return ul;
        },
        render_month_product: function() {
            var self = this;
            var container = $('<div />');
            var ul = $('<ul style="font-size: 0.7em;margin: 10px 0;line-height: 1.5em;" />');
            ul = self.get_rksv_product(ul, self.pos.config.start_product_id, 'Startbeleg');
            ul = self.get_rksv_product(ul, self.pos.config.month_product_id, 'Monatsbeleg');
            ul = self.get_rksv_product(ul, self.pos.config.year_product_id, 'Jahresbeleg');
            ul = self.get_rksv_product(ul, self.pos.config.null_product_id, 'Nullbeleg');
            ul = self.get_rksv_product(ul, self.pos.config.invoice_product_id, 'Referenzbeleg');
            container.append(ul);
            if (this.pos.rksv.statuses['rksv_products_exists']) {
                self.$('.monthproduct-status-indicator .indicator').css('background', 'green');
                self.$('.monthproduct-status-indicator .indicator-message').html("RKSV Produkte vollständig! <br />" + container.html());
            } else {
                self.$('.monthproduct-status-indicator .indicator').css('background', 'red');
                self.$('.monthproduct-status-indicator .indicator-message').html("RKSV Produkte unvollständig! <br />" + container.html());
            }
        },
        se_status_handler: function() {
            var self = this;
            if (self.pos.signatures === undefined) return;
            // Listen on status update for signaturs - display the change here
            this.pos.signatures.bind('add remove', function(signature) {
                // Do rerender the sprovider view
                self.render_sproviders();
            });
            this.pos.signatures.bind('change:bmf_status change:bmf_message change:bmf_last_status', function(signature) {
                if (!signature.isActive(self.pos))
                    // Ignore this update if it does not belong to the active signature
                    return;
                var color = 'red';
                var message = 'Signatur registriert und inaktiv';
                var cashbox_mode = self.pos.get('cashbox_mode');
                if ((signature.get('bmf_status')) && signature.get('bmf_last_status') == 'IN_BETRIEB' && (cashbox_mode == 'active' || cashbox_mode == 'setup')) {
                    color = 'green';
                    message = 'Signatureinheit registriert und aktiv';
                    self.$('.sprovider-bmf-btn').hide();
                    self.$('.sprovider-bmf-ausfall-btn').hide();
                    self.$('.sprovider-bmf-wiederinbetriebnahme-btn').hide();
                } else if (signature.get('bmf_last_status') == 'AUSFALL') {
                    message = signature.get('bmf_last_status')+ ', ' + (signature.get('bmf_message')?signature.get('bmf_message'):'');
                    self.$('.sprovider-bmf-btn').hide();
                    self.$('.sprovider-bmf-ausfall-btn').hide();
                    self.$('.sprovider-bmf-wiederinbetriebnahme-btn').show();
                } else {
                    message = signature.get('bmf_last_status')+ ', ' + (signature.get('bmf_message')?signature.get('bmf_message'):'');
                    self.$('.sprovider-bmf-btn').show();
                    self.$('.sprovider-bmf-ausfall-btn').show();
                    self.$('.sprovider-bmf-wiederinbetriebnahme-show').show();
                }
                self.$('.signature-provider-status-indicator .indicator').css('background', color);
                self.$('.signature-provider-status-indicator .indicator-message').html(message);
                self.auto_open_close();
            });
        },
        rk_status_handler: function() {
            var self = this;
            // Listen on status update for kasse
            self.pos.bind('change:bmf_status_rk', function(pos, status) {
                self.$('.cashbox-message-box').html(status.message);
                //check rk  -needs to be registered with bmf
                if ((!self.pos.config.cashregisterid) || (self.pos.config.cashregisterid.trim() == "")) {
                    self.$('.cashbox-status-indicator .indicator').css('background', 'orange');
                    self.$('.cashbox-status-indicator .indicator-message').html("Keine gültige KassenID ist gesetzt !");
                    self.$('.cashbox-status-indicator .activate_cashbox').hide();
                } else if (status.success) {
                    self.$('.cashbox-status-indicator .indicator').css('background', 'green');
                    self.$('.cashbox-status-indicator .indicator-message').html(status.message);
                    self.$('.cashbox-status-indicator .activate_cashbox').hide();
                } else {
                    self.$('.cashbox-status-indicator .indicator').css('background', 'red');
                    self.$('.cashbox-status-indicator .indicator-message').html(status.message);
                    if ((self.pos.rksv.bmf_auth_data()==true) && (!(status.connection===false)))
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
                // Do update the datetime and status here
                if (status.newValue.drivers.rksv && status.newValue.drivers.rksv.posbox_vienna_datetime) {
                    self.$('#rksv_posbox_datetime').html(status.newValue.drivers.rksv.posbox_vienna_datetime);
                }
                if (status.newValue.drivers.rksv && status.newValue.drivers.rksv.posbox_rksv_lib_version) {
                    self.$('#rksv_rksv_version').html(status.newValue.drivers.rksv.posbox_rksv_lib_version.version);
                }
                if (status.newValue.drivers.rksv && status.newValue.drivers.rksv.posbox_rksv_mod_version) {
                    self.$('#rksv_addon_version').html(status.newValue.drivers.rksv.posbox_rksv_mod_version.version);
                }
                if (status.newValue.drivers.rksv && status.newValue.drivers.rksv.posbox_bmf_mod_version) {
                    self.$('#rksv_bmf_version').html(status.newValue.drivers.rksv.posbox_bmf_mod_version.version);
                }
                // Also check current bmf_status_rk
                if ((status.newValue.status == "connected") && (!this.pos.get('bmf_status_rk').success)) {
                    // BMF Status RK is false - so do recheck the status here
                    self.pos.rksv.update_bmf_rk_status();
                }
                //this.pos.posbox_status = status.newValue.status;
                if (status.newValue.status == "connected") {
                    self.$('.posbox-status-indicator .indicator').css('background', 'green');
                    self.$('.posbox-status-indicator .indicator-message').html('PosBox verbunden (' + status.newValue.status + ')');
                } else {
                    self.$('.posbox-status-indicator .indicator').css('background', 'red');
                    self.$('.posbox-status-indicator .indicator-message').html('PosBox getrennt (' + status.newValue.status + ')');
                }
                // Check if we have to activate ourself
                if (status.newValue.status === 'connected' && (!(self.pos.config.state === "failure" || self.pos.config.state === "inactive"))) {
                    var rksvstatus = status.newValue.drivers.rksv ? status.newValue.drivers.rksv.status : false;
                    var rksvmessage = status.newValue.drivers.rksv && status.newValue.drivers.rksv.message ? status.newValue.drivers.rksv.message : false;
                    if (!rksvstatus) {
                        self.$('.rksv-status-indicator .register_startreceipt').hide();
                        self.$('.rksv-status-indicator .register_cashbox').hide();
                        self.$('.rksv-status-indicator .indicator').css('background', 'red');
                        rksvmessage = "Status unbekannt";
                    } else if (rksvstatus == 'connected') {
                        self.$('.rksv-status-indicator .register_startreceipt').hide();
                        self.$('.rksv-status-indicator .register_cashbox').hide();
                        // Everything is correct
                        self.$('.rksv-status-indicator .indicator').css('background', 'green');
                        rksvmessage = "PosBox Modul verbunden";
                    } else if (rksvstatus == 'invalidstartreceipt') {
                        self.$('.rksv-status-indicator .register_startreceipt').show();
                        self.$('.rksv-status-indicator .register_cashbox').hide();
                        // Validation of start receipt failed - activate the try again button
                        self.$('.rksv-status-indicator .indicator').css('background', 'orange');
                        rksvmessage = "Validierungsfehler!";
                    } else if (rksvstatus == 'failure') {
                        self.$('.rksv-status-indicator .register_startreceipt').hide();
                        self.$('.rksv-status-indicator .register_cashbox').hide();
                        self.$('.rksv-status-indicator .indicator').css('background', 'red');
                        rksvmessage = "Fehler";
                    } else if (rksvstatus == 'doesnotexists') {
                        self.$('.rksv-status-indicator .register_startreceipt').hide();
                        self.$('.rksv-status-indicator .register_cashbox').show();
                        // Cashbox is not registered on this posbox !
                        self.$('.rksv-status-indicator .indicator').css('background', 'red');
                        rksvmessage = "Kassen ID nicht auf dieser PosBox registriert!";
                    } else {
                        self.$('.rksv-status-indicator .register_startreceipt').hide();
                        self.$('.rksv-status-indicator .register_cashbox').hide();
                        // Only show it if it is not already in state visible !
                        self.$('.rksv-status-indicator .indicator').css('background', 'red');
                        self.$('.rksv-status-indicator .register_cashbox').hide();
                    }
                    if (!rksvmessage) {
                        rksvmessage = "Status: " + status.newValue.drivers && status.newValue.drivers.rksv && status.newValue.drivers.rksv.status ? status.newValue.drivers.rksv.status : '?';
                    }
                    if (status.newValue.drivers.rksv && status.newValue.drivers.rksv.messages){
                        var container = $('<div />')
                        container.append(rksvmessage + ' (' + rksvstatus + ')');
                        var messages = $('<ul style="font-size: 0.7em;margin: 10px 0;line-height: 1.5em;" />');
                        status.newValue.drivers.rksv.messages.forEach(function(message) {
                            messages.append('<li>' + message + '</li>');
                        });
                        container.append(messages);
                        rksvmessage = container.html();
                    }
                    self.$('.rksv-status-indicator .indicator-message').html(rksvmessage);

                } else if (status.newValue.status === 'connected' && (self.pos.config.state === "setup")) {
                    self.$('.rksv-status-indicator .indicator').css('background', 'red');
                    self.$('.rksv-status-indicator .indicator-message').html("Kasse befindet sich im Status Setup !");
                    self.$('.rksv-status-indicator .register_cashbox').show();
                } else if (status.newValue.status === 'connected' && (self.pos.config.state === "failure")) {
                    self.$('.rksv-status-indicator .indicator').css('background', 'red');
                    self.$('.rksv-status-indicator .indicator-message').html("Kasse ist markiert als ausgefallen !");
                } else if (status.newValue.status === 'connected' && (self.pos.config.state === "inactive")) {
                    self.$('.rksv-status-indicator .indicator').css('background', 'red');
                    self.$('.rksv-status-indicator .indicator-message').html("Kasse ist deaktviert !");
                }
                /*
                It should always be possible to use an other signature provider

                if (self.pos.get('cashbox_mode') == 'active'){
                    self.$el.find('.sprovider-btn').hide()
                }
                */
                if (self.pos.get('cashbox_mode') == 'signature_failed'){
                    self.$el.find('.sprovider-btn').show()
                }
                if (self.pos.get('cashbox_mode') == 'posbox_failed'){
                    
                }
                self.auto_open_close();
            });
        },
        render_card: function (card) {
            var valid_vat = false;
            var company_vat = this.pos.company.bmf_vat_number;
            if (card.matchVAT(company_vat)) {
                valid_vat = true;
            }
            if (!valid_vat) {
                // Try to match against Steuernummer
                if (card.matchTaxNumber(this.pos.company.bmf_tax_number)) {
                    valid_vat = true;
                }
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
                    self.pos.rksv.set_signature(event.target.value).then(
                        function done() {
                            self.$('.provider-message-box').empty();
                            self.$('.provider-message-box').append('<p style="color:green;">Signatur Provider wurde gesetzt.</p>');
                        },
                        function failed(message) {
                            self.$('.provider-message-box').empty();
                            self.$('.provider-message-box').append('<p style="color:red;">' + message + '</p>');
                        }
                    );
                } else {
                    self.pos.gui.show_popup('error',{
                        'title': _t("Passwort falsch"),
                        'body': _t("Das richtige POS Admin Passwort wird benötigt.")
                    });
                }
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

    /*------------------------------------------*\
    |         THE RKSV RECEIPT SCREEN            |
    \*==========================================*/

    // The receipt screen displays the order's
    // receipt and allows it to be printed in a web browser.
    // The receipt screen is not shown if the point of sale
    // is set up to print with the proxy. Altough it could
    // be useful to do so...

    var ReceiptRKSVScreenWidget = screens.ScreenWidget.extend({
        template: 'ReceiptScreenWidget',
        show: function (options) {
            this._super();
            var self = this;
            var order = this.pos.get_order();
            if (order) {
                var data = order.get_screen_data('params');
                this.add_action_button({
                    label: _t('Print'),
                    icon: '/point_of_sale/static/src/img/icons/png48/printer.png',
                    click: function(){ self.print(data); },
                });
                this.add_action_button({
                    label: _t('Go Back'),
                    icon: '/point_of_sale/static/src/img/icons/png48/go-previous.png',
                    click: function() { self.pos.gui.back(); },
                });
                this.render_receipt(data);
                this.handle_auto_print();
            }
        },
        handle_auto_print: function () {
            if (this.should_auto_print()) {
                this.print();
                if (this.should_close_immediately()) {
                    this.click_back();
                }
            } else {
                this.lock_screen(false);
            }
        },
        should_auto_print: function () {
            return this.pos.config.iface_print_auto;
        },
        should_close_immediately: function () {
            return this.pos.config.iface_print_via_proxy && this.pos.config.iface_print_skip_screen;
        },
        lock_screen: function (locked) {
            this._locked = locked;
            if (locked) {
                this.$('.next').removeClass('highlight');
            } else {
                this.$('.next').addClass('highlight');
            }
        },
        print_web: function () {
            window.print();
        },
        print_xml: function (data) {
            var pos = this.pos
            var order = pos.get_order();
            var env = {
                widget: this,
                order: order,
                title: data.title,
                receipt: data.receipt,
            };
            var receipt = QWeb.render('RKSVReceipt', env);
            this.pos.proxy.print_receipt(receipt);
        },
        print: function (data) {
            var self = this;

            if (!this.pos.config.iface_print_via_proxy) { // browser (html) printing

                // The problem is that in chrome the print() is asynchronous and doesn't
                // execute until all rpc are finished. So it conflicts with the rpc used
                // to send the orders to the backend, and the user is able to go to the next
                // screen before the printing dialog is opened. The problem is that what's
                // printed is whatever is in the page when the dialog is opened and not when it's called,
                // and so you end up printing the product list instead of the receipt...
                //
                // Fixing this would need a re-architecturing
                // of the code to postpone sending of orders after printing.
                //
                // But since the print dialog also blocks the other asynchronous calls, the
                // button enabling in the setTimeout() is blocked until the printing dialog is
                // closed. But the timeout has to be big enough or else it doesn't work
                // 1 seconds is the same as the default timeout for sending orders and so the dialog
                // should have appeared before the timeout... so yeah that's not ultra reliable.
                this.lock_screen(true);

                setTimeout(function () {
                    self.lock_screen(false);
                }, 1000);

                this.print_web();
            } else {    // proxy (xml) printing
                this.print_xml(data);
                this.lock_screen(false);
            }
        },
        click_back: function () {

        },
        renderElement: function () {
            var self = this;
            this._super();
            this.$('.next').click(function () {
                if (!self._locked) {
                    self.click_next();
                }
            });
            this.$('.back').click(function () {
                if (!self._locked) {
                    self.click_back();
                }
            });
            this.$('.button.print').click(function () {
                if (!self._locked) {
                    self.print();
                }
            });
        },
        render_receipt: function (data) {
            var pos = this.pos;
            var order = pos.get_order();
            this.$('.pos-receipt-container').html(QWeb.render('RKSVTicket', {
                title: data.title,
                receipt: data.receipt,
                widget: this,
                order: order,
                company: pos.company,
            }));
        },
    });
   gui.define_screen({name:'receipt_rksv', widget: ReceiptRKSVScreenWidget});
});
