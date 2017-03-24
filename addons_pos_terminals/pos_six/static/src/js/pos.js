/**
 * Created by wolfgangpichler on 15.11.16.
 */
odoo.define('pos_six.pos', function (require) {
    "use strict";

    var core = require('web.core');
    var QWeb = core.qweb;
    var screens = require('point_of_sale.screens');
    var models = require('point_of_sale.models');
    var PopupWidget = require('point_of_sale.popups');
    var chrome = require('point_of_sale.chrome');
    var devices = require('point_of_sale.devices');
    var gui = require('point_of_sale.gui');
    var _t = core._t;

    // Include the is_sixx_terminal field
    models.load_fields("account.journal", [ "is_sixx_terminal", "sixx_terminal_id", "auto_validate" ]);

    if (!chrome.Chrome.prototype.replace_widget) {
        chrome.Chrome.include({
            replace_widget: function (name, widget_config) {
                for (var i = 0; i < this.widgets.length; i++) {
                    if (this.widgets[i]['name'] == name) {
                        this.widgets[i] = widget_config;
                    }
                }

            }
        });
    }

    // Extend     render_paymentlines: function() { - we have to set state on button according to current payment line state
    screens.PaymentScreenWidget.include({
        render_paymentlines: function() {
            var self = this;
            // Supercall does render the payment lines
            this._super();
            // So we now have the lines in .paymentlines-container
            // Remove old event handlers
            this.$('.payment-terminal-transaction-start').off();
            this.$('.payment-terminal-transaction-abort').off();
            this.$('.payment-terminal-transaction-reversal').off();
            // Install new event handlers
            this.$('.payment-terminal-transaction-start').on('click', function(){
                self.pos.mpd.payment_terminal_transaction_start($(this).data('cid'), self.pos.currency.name);
            });
            this.$('.payment-terminal-transaction-abort').on('click', function(){
                self.pos.mpd.payment_terminal_transaction_abort();
            });
            this.$('.payment-terminal-transaction-reversal').on('click', function(){
                self.pos.mpd.payment_terminal_transaction_reversal($(this).data('cid'), self.pos.currency.name);
            });
        },
        render_paymentline : function(line){
            // Supercall using prototype
            var line = this._super(line);
            // Register gui hooks
            var self  = this;
            // Bind on the new terminal payment button
            $(line).on('click', '.payment-terminal-transaction-start', function(event){
                self.pos.mpd.payment_terminal_transaction_start($(this).data('cid'), self.pos.currency.name);
            }).on('click', '.payment-terminal-transaction-abort', function(event){
                self.pos.mpd.payment_terminal_transaction_abort();
            }).on('click', '.payment-terminal-transaction-reversal', function(event){
                self.pos.mpd.payment_terminal_transaction_reversal($(this).data('cid'), self.pos.currency.name);
            });
            var order = this.pos.get_order();
            if (!order) {
                return line;
            }

            order.get('paymentLines').each(function(paymentLine){
                if ((order.is_return_order) && (paymentLine.cashregister.journal.is_sixx_terminal)) {
                    $(line).find('.payment-terminal-transaction-start[data-cid=' + paymentLine.cid + ']').removeClass('oe_hidden');
                    $(line).find('.payment-terminal-transaction-start[data-cid=' + paymentLine.cid + ']').html('Storno');
                    $(line).find('.payment-terminal-transaction-reversal[data-cid=' + paymentLine.cid + ']').addClass('oe_hidden');
                    $(line).find('.payment-terminal-transaction-abort[data-cid=' + paymentLine.cid + ']').addClass('oe_hidden');
                } else if ((paymentLine.cashregister.journal.is_sixx_terminal) && (paymentLine.ref_number) && (paymentLine.ref_number>'')) {
                    $(line).find('.payment-terminal-transaction-start[data-cid=' + paymentLine.cid + ']').addClass('oe_hidden');
                    $(line).find('.payment-terminal-transaction-reversal[data-cid=' + paymentLine.cid + ']').removeClass('oe_hidden');
                    $(line).find('.payment-terminal-transaction-abort[data-cid=' + paymentLine.cid + ']').addClass('oe_hidden');
                } else if (paymentLine.cashregister.journal.is_sixx_terminal) {
                    $(line).find('.payment-terminal-transaction-start[data-cid=' + paymentLine.cid + ']').removeClass('oe_hidden');
                    $(line).find('.payment-terminal-transaction-start[data-cid=' + paymentLine.cid + ']').html(paymentLine.get_transaction_amount_str());
                    $(line).find('.payment-terminal-transaction-reversal[data-cid=' + paymentLine.cid + ']').addClass('oe_hidden');
                    $(line).find('.payment-terminal-transaction-abort[data-cid=' + paymentLine.cid + ']').addClass('oe_hidden');
                }
            });
            return line;
        },
        payment_input: function(input) {
            var order = this.pos.get_order();
            if ((order.selected_paymentline) && (order.selected_paymentline.ref_number) && (order.selected_paymentline.ref_number>'')) {
                return;
            } else {
                this._super.apply(this, arguments);
            }
        },

    });

    // Extend Order Model
    // remove_paymentline: function in Order Model - if there is a ref number attached - then we need to do a reversal
    // add_paymentline: store the amount to pay in transaction_amount - and set paid amount to 0
    var OrderModelParent = models.Order;
    models.Order = models.Order.extend({
        remove_paymentline: function(line){
            console.log('in remove_paymentline');
            if ((line.ref_number) && (line.ref_number > '')) {
                console.log('do not remove - there is a payment already on this line');
                return false;
            } else {
                // Normal Super Call
                OrderModelParent.prototype.remove_paymentline.apply(this, arguments);
            }
        },
        add_paymentline: function(cashregister) {
            // Get open amount before we add the payment line
            var open_amount = this.get_due();
            // Do make super call
            OrderModelParent.prototype.add_paymentline.apply(this, arguments);
            // Check - if this is a sixx payment terminal payment line - then set amount to 0 !
            if (cashregister.journal.is_sixx_terminal) {
                if (this.is_return_order) {
                    this.selected_paymentline.set_transaction_amount(open_amount);
                    this.selected_paymentline.set_amount(0);
                    this.selected_paymentline.set_is_return_line(true);
                    this.pos.gui.screen_instances.payment.render_paymentlines();
                } else {
                    this.selected_paymentline.set_transaction_amount(open_amount);  // this.selected_paymentline.get_amount()
                    this.selected_paymentline.set_amount(0);
                    this.selected_paymentline.set_is_return_line(false);
                    this.pos.gui.screen_instances.payment.render_paymentlines();
                }
            }
        },
    });

    // Extend Paymentline Model
    var PaymentlineModelParent = models.Paymentline;
    models.Paymentline = models.Paymentline.extend({
        nl2br: function(str, is_xhtml) {
            var breakTag = '<br />';
            return (str + '').replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g, '$1' + breakTag + '$2');
        },

        // Add six payment ref field to json export
        export_as_JSON: function() {
            var json = PaymentlineModelParent.prototype.export_as_JSON.apply(this, arguments);
            json['ref_number'] = this.ref_number;
            json['receipt'] = this.receipt;
            json['receipt_html'] = this.nl2br(this.receipt);
            if ((this.receipt_merchant) && (this.receipt_merchant>'')) {
                json['receipt_merchant'] = this.receipt_merchant;
                json['receipt_merchant_html'] = this.nl2br(this.receipt_merchant);
            }
            return json;
        },
        export_for_printing: function(){
            var json = PaymentlineModelParent.prototype.export_for_printing.apply(this, arguments);
            json['ref_number'] = this.ref_number;
            json['transaction_amount'] = this.transaction_amount;
            json['six_receipt'] = this.receipt;
            json['six_receipt_html'] = this.nl2br(this.receipt);
            return json;
        },
        init_from_JSON: function(json){
            PaymentlineModelParent.prototype.init_from_JSON.apply(this, arguments);
            this.ref_number = ('ref_number' in json?json['ref_number']:false);
            this.receipt = ('receipt' in json?json['receipt']:false);
            this.receipt_merchant = ('receipt_merchant' in json?json['receipt_merchant']:false);
            this.transaction_amount = ('transaction_amount' in json?json['transaction_amount']:0);
        },
        //sets the amount of money on this payment line for sixx transaction
        set_transaction_amount: function(value){
            this.transaction_amount = value;
            this.trigger('change',this);
        },
        //sets the return line flag
        set_is_return_line: function(value){
            this.is_return_line = value;
            this.trigger('change',this);
        },
        // returns the amount of money on this paymentline for transaction
        get_transaction_amount: function(){
            return this.transaction_amount;
        },
        get_transaction_amount_str: function(){
            return openerp.instances.instance0.web.format_value(this.amount, {
                type: 'float', digits: [69, this.pos.currency.decimals]
            });
        },
    });

    // Define our own MPD Class - does provide all terminal related functions
    var MPD = core.Class.extend({
        shift_state: 'unknown',
        closed_manual: false,

        init: function(attributes){
            console.log('MPD init got called !');
            this.pos = attributes.pos;
            this.pos.set('mpdstatus', { 'connection': {'status': 'connecting' } });
            this.proxy = attributes.proxy;
            this.shutdown = false;
            // Install callback for proxy status change
            var self = this;
            this.proxy.on('change:status',this,function(eh,status) {
                console.log('MPD: Proxy status='+status.newValue.status);
                if (status.newValue.drivers.mpd) {
                    var mpdstatus = status.newValue.drivers.mpd;
                    console.log('set mpd status: '+ mpdstatus.status);
                    self.pos.set('mpdstatus', mpdstatus);
                } else {
                    this.pos.set('mpdstatus', { 'connection': {'status': 'connecting' } });
                }
            });
        },

        start: function() {
            console.log('MPD start got called');
            this.proxy.on('change:status',this,function(eh,status) {
                console.log('MPD: Proxy status=' + status.newValue.status);
            });
        },
        payment_terminal_initialize: function() {
            console.log('Initialize got called');
            var self = this;
            this.display_receipt('Initialisierung gestartet...', '');
            this.pos.gui.popup_instances.mpd_popup.show();
            this.proxy.message('mpd/initialize').then(
                function done(result) {
                    if (result['success']==true) {
                        self.display_receipt('Initialisierung erfolgreich', '');
                    } else {
                        var error = result['errorcode'] + ': ' + result['errormessage'];
                        self.display_receipt('FEHLER', error);
                    }
                },
                function failed() {
                    self.display_receipt('FEHLER', 'Fehler bei der Kommunikation mit der PosBox');
                }
            );
        },

        payment_terminal_setup: function() {
            console.log('Setup got called');
            var self = this;
            this.display_receipt('Setup gestartet...', '');
            this.pos.gui.popup_instances.mpd_popup.show();
            this.proxy.message('mpd/configure').then(
                function done(result) {
                    if (result['success']==true) {
                        self.display_receipt('Setup erfolgreich', '');
                    } else {
                        var error = result['errorcode'] + ': ' + result['errormessage'];
                        self.display_receipt('FEHLER', error);
                    }
                },
                function failed() {
                    self.display_receipt('FEHLER', 'Fehler bei der Kommunikation mit der PosBox');
                }
            );
        },
        payment_terminal_reboot: function() {
            console.log('Reboot got called');
            var self = this;
            this.display_receipt('Neustart auslösen...', '');
            this.pos.gui.popup_instances.mpd_popup.show();
            this.proxy.message('mpd/reboot').then(
                function done(result) {
                    if (result['success']==true) {
                        self.display_receipt('Neustart ausgelöst', 'Bitte warten bis das Terminal vollständig gestartet wurde');
                    } else {
                        var error = result['errorcode'] + ': ' + result['errormessage'];
                        self.display_receipt('FEHLER', error);
                    }
                },
                function failed() {
                    self.display_receipt('FEHLER', 'Fehler bei der Kommunikation mit der PosBox');
                }
            );
        },
        payment_terminal_reconnect: function() {
            console.log('Reconnect got called');
            var self = this;
            this.display_receipt('Neu verbinden...', '');
            this.pos.gui.popup_instances.mpd_popup.show();
            this.proxy.message('mpd/reconnect').then(
                function done(result) {
                    if (result['success']==true) {
                        self.display_receipt('Neu Verbunden', 'Sstatus wird sich in Kürze aktualisieren');
                    } else {
                        var error = result['errorcode'] + ': ' + result['errormessage'];
                        self.display_receipt('FEHLER', error);
                    }
                },
                function failed() {
                    self.display_receipt('FEHLER', 'Fehler bei der Kommunikation mit der PosBox');
                }
            );
        },
        payment_terminal_status: function() {
            console.log('Status got called');
            var self = this;
            this.display_receipt('Status wird aktualisiert...', '');
            this.pos.gui.popup_instances.mpd_popup.show();
            this.proxy.message('mpd/request_status').then(
                function done(result) {
                    if (result['success']==true) {
                        self.display_receipt('Status aktualisiert', '');
                    } else {
                        var error = result['errorcode'] + ': ' + result['errormessage'];
                        self.display_receipt('FEHLER', error);
                    }
                },
                function failed() {
                    self.display_receipt('FEHLER', 'Fehler bei der Kommunikation mit der PosBox');
                }
            );
        },
        payment_terminal_transaction_abort: function(){
            this.pos.set('mpdstatus', {
                'connection': {'status': 'working'},
            });
            this.proxy.message('mpd/abort').then(
                function done() {
                    console.log('Abort done');
                },
                function failed() {
                    console.log('Abort failed');
                }
            );
        },

        payment_terminal_transaction_start: function(line_cid, currency_iso, ref){
            var self = this;
            var order = this.pos.get_order();
            var line = null;
            _.each(order.get_paymentlines(), function(cline) {
                if (cline['cid'] == line_cid) {
                    line = cline;
                }
            }, this);
            var data = {};
            if (line.is_return_line==true) {
                if (!ref) {
                    // We should display a popup here to get the original ref number !
                    this.pos.pos_widget.mpd_ref.show({
                        'callback': function (ref) {
                            self.payment_terminal_transaction_start(line_cid, currency_iso, ref);
                        }
                    });
                    return;
                } else {
                    data = {
                        'amount': line.get_transaction_amount(),
                        'currency_iso': currency_iso,
                        'ref': ref,
                        'tid': line.cashregister.journal.sixx_terminal_id
                    };
                }
            } else {
                data = {
                    'amount': line.get_transaction_amount(),
                    'currency_iso': currency_iso,
                    'ref': order.sequence_number,
                    'tid': line.cashregister.journal.sixx_terminal_id
                };
            }
            $('.payment-terminal-transaction-start[data-cid='+line_cid+']').addClass('oe_hidden');
            $('.payment-terminal-transaction-reversal[data-cid='+line_cid+']').addClass('oe_hidden');
            $('.payment-terminal-transaction-abort[data-cid='+line_cid+']').removeClass('oe_hidden');
            this.pos.set('mpdstatus', {
                'connection': {'status': 'working'},
            });

            this.proxy.message('mpd/transaction', data, { timeout: 120000 }).then(
                function done(result) {
                    if ((result) && (result.success==true)) {
                        console.log('Attach ref number to payment line');
                        line.ref_number = result.ref_number;
                        line.receipt = result.receipt;
                        if ((result['receipt-merchant']) && (result['receipt-merchant'] > '')) {
                            line.receipt_merchant = result['receipt-merchant'];
                        }
                        $('.payment-terminal-transaction-start[data-cid=' + line_cid + ']').addClass('oe_hidden');
                        $('.payment-terminal-transaction-reversal[data-cid=' + line_cid + ']').removeClass('oe_hidden');
                        $('.payment-terminal-transaction-abort[data-cid=' + line_cid + ']').addClass('oe_hidden');
                        var order = self.pos.get_order();
                        // Set Amount from transaction
                        if (line.is_return_line==true) {
                            line.set_amount(-1 * result.amount);
                        } else {
                            line.set_amount(result.amount);
                        }
                        // Do re render paymentline with it
                        self.pos.gui.screen_instances.payment.render_paymentlines();
                        // If receipt_copy_count is greater than 1 - then immediate print the receipt with the auth result
                        if ((result['receipt-merchant']) && (result['receipt-merchant'] > '') && (result['receipt_signature_flag'] == '1')) {
                            self.print_receipt(result['receipt-merchant']);
                        }
                        // Do automatically try to validate order if paymentline has configured it
                        if (order.selected_paymentline.cashregister.journal.auto_validate) {
                            self.pos.gui.screen_instances.payment.validate_order();
                        }
                    } else {
                        console.log('Transaction aborted or failed');
                        $('.payment-terminal-transaction-start[data-cid='+line_cid+']').removeClass('oe_hidden');
                        $('.payment-terminal-transaction-reversal[data-cid='+line_cid+']').addClass('oe_hidden');
                        $('.payment-terminal-transaction-abort[data-cid='+line_cid+']').addClass('oe_hidden');
                        if (result) {
                            self.pos.gui.show_popup('error', {
                                'title': _t('Fehler'),
                                'body': result['errorcode'] + ': ' + result['errormessage'],
                            });
                        } else {
                            self.pos.gui.show_popup('error', {
                                'title': _t('Fehler'),
                                'body': _t('Unbekannter Fehler bei der Kommunikation mit der PosBox ist aufgetretten'),
                            });
                        }

                    }
                },
                function failed() {
                    $('.payment-terminal-transaction-start[data-cid='+line_cid+']').removeClass('oe_hidden');
                    $('.payment-terminal-transaction-reversal[data-cid='+line_cid+']').addClass('oe_hidden');
                    $('.payment-terminal-transaction-abort[data-cid='+line_cid+']').addClass('oe_hidden');
                }
            );
        },

        payment_terminal_transaction_reversal: function(line_cid, currency_iso){
            var order = this.pos.get_order();
            var line = order.get('paymentLines')._byId[line_cid];

            var data = {'amount' : (-1) * line.get_amount(),
                        'currency_iso' : currency_iso,
                        'ref' : line.ref_number,
                        'tid' : line.cashregister.journal.sixx_terminal_id};
            this.pos.set('mpdstatus', {
                'connection': {'status': 'working'},
            });
            var self = this;
            this.proxy.message('mpd/transaction', data).then(
                function done(result) {
                    if (result.success==true) {
                        console.log('Remove ref number from payment line');
                        line.ref_number = null;
                        $('.payment-terminal-transaction-start[data-cid=' + line_cid + ']').removeClass('oe_hidden');
                        $('.payment-terminal-transaction-reversal[data-cid=' + line_cid + ']').addClass('oe_hidden');
                        $('.payment-terminal-transaction-abort[data-cid=' + line_cid + ']').addClass('oe_hidden');
                        var order = self.pos.get_order();
                        // Set Amount from transaction
                        order.selected_paymentline.set_amount(0);
                        // Do re render paymentline with it
                        self.pos.gui.screen_instances.payment.render_paymentlines();
                        // Do print the reversal receipt
                        self.print_receipt(result['receipt']);
                    } else {
                        console.log('Reversal failed');
                        $('.payment-terminal-transaction-start[data-cid='+line_cid+']').addClass('oe_hidden');
                        $('.payment-terminal-transaction-reversal[data-cid='+line_cid+']').removeClass('oe_hidden');
                        $('.payment-terminal-transaction-abort[data-cid='+line_cid+']').addClass('oe_hidden');
                    }
                },
                function failed() {
                    $('.payment-terminal-transaction-start[data-cid='+line_cid+']').addClass('oe_hidden');
                    $('.payment-terminal-transaction-reversal[data-cid='+line_cid+']').removeClass('oe_hidden');
                    $('.payment-terminal-transaction-abort[data-cid='+line_cid+']').addClass('oe_hidden');
                }
            );
        },

        // Call open shift function - do return the deferred object
        open_shift: function(cashier) {
            this.pos.gui.popup_instances.mpd_popup.loading(_t('Schicht wird geöffnet...'));
            console.log('open shift got called');
            var self = this;
            this.proxy.message('mpd/open', {'cashier': cashier}, {'timeout': 15000}).then(
                function done(result) {
                    if (result['success']==true) {
                        self.display_receipt('Schicht geöffnet', result['receipt']);
                        // Do print this balance receipt
                        self.print_receipt(result['receipt']);
                    } else {
                        var error = result['errorcode'] + ': ' + result['errormessage'];
                        self.display_receipt('FEHLER', error);
                    }
                    self.pos.gui.popup_instances.mpd_popup.loading_done();
                },
                function failed() {
                    console.log('open shift failed');
                    self.gui.show_popup('error',{
                        'title': _t('Fehler'),
                        'body': _t('Fehler bei der Anfrage an das Terminal'),
                    });
                    self.pos.gui.popup_instances.mpd_popup.loading_done();
                }
            );

        },

        // Call close shift function - do return the deferred object
        close_shift: function(manual) {
            this.closed_manual = manual;
            var mpd_popup = this.pos.gui.popup_instances.mpd_popup;
            mpd_popup.loading(_t('Schicht wird geschlossen...'));
            console.log('close shift got called');
            var self = this;
            this.proxy.message('mpd/close', {}, {'timeout': 15000}).then(
                function done(result) {
                    if (result['success']==true) {
                        self.display_receipt('Schicht geschlossen', result['receipt']);
                        // Do print this balance receipt
                        self.print_receipt(result['receipt']);
                    } else {
                        var error = result['errorcode'] + ': ' + result['errormessage'];
                        self.display_receipt('FEHLER', error);
                    }
                    mpd_popup.loading_done();
                },
                function failed() {
                    console.log('close shift failed');
                    self.gui.show_popup('error',{
                        'title': _t('Fehler'),
                        'body': _t('Fehler bei der Anfrage an das Terminal'),
                    });
                    mpd_popup.loading_done();
                }
            );
        },
        connected: function() {
            var status = this.pos.get('mpdstatus');
            return (status.status=='connected'?true:false);
        },
        // Call open shift function - do return the deferred object
        balance: function() {
            var mpd_popup = this.pos.gui.popup_instances.mpd_popup;
            mpd_popup.loading(_t('Terminal Abrechnung wird übertragen. Dieser Vorgang kann etwas Zeit in Anspruch nehmen. Bitte um Geduld !'));

            console.log('get balance got called');
            var self = this;
            var dfd = $.Deferred();
            if (!this.connected()) {
                mpd_popup.loading_done();
                return false;
            }
            this.proxy.message('mpd/balance', {}, {'timeout': 60000}).then(
                function done(result) {
                    if (result['success']==true) {
                        self.display_receipt('Balance', result['receipt']);
                        // Do print this balance receipt
                        self.print_receipt(result['receipt']);
                        dfd.resolve();
                    } else {
                        var error = result['errorcode'] + ': ' + result['errormessage'];
                        self.display_receipt('FEHLER', error);
                        dfd.resolve();
                    }
                    mpd_popup.loading_done();
                },
                function failed() {
                    console.log('balance operation failed');
                    self.gui.show_popup('error',{
                        'title': _t('Fehler'),
                        'body': _t('Fehler bei der Balance Operation'),
                    });
                    mpd_popup.loading_done();
                    dfd.resolve();
                }
            );
            return dfd;
        },

        connect: function(){
            console.log('MPD connect got called !');
        },

        disconnect: function(){
            console.log('MPD disconnect got called !');
        },

        connect_to_proxy: function(){
            console.log('MPD connect to proxy got called !');
        },

        disconnect_from_proxy: function(){
            console.log('MPD disconnect from proxy got called !');
        },

        display_receipt: function(title, receipt) {
            $('#mpd_last_receipt').html('<h2>' + title + '</h2>' + receipt);
            $('#mpd_last_receipt').removeClass('oe_hidden');
        },

        print_receipt: function(receipt) {
            this.pos.proxy.print_receipt(QWeb.render('RawReceipt',{
                receipt: receipt, widget: this,
            }));
        },

    });

    // Add our mpd class to the global pos namespace
    var PosModelSuper = models.PosModel;
    models.PosModel = models.PosModel.extend({
        initialize: function (session, attributes) {
            // Call super call
            PosModelSuper.prototype.initialize.apply(this, arguments);
            // Do connect initialize MPD Class
            this.mpd = new MPD({'pos': this, 'proxy': this.proxy});
            this.bind('change:mpdstatus', function(pos,status){
                if ((status.status=='connected') && (status.shift_state=='Closed') && (pos.config.auto_terminal_shift) && (!pos.mpd.shutdown)  && (!pos.mpd.closed_manual) ) {
                    var cashier = pos.cashier || pos.user;
                    pos.mpd.open_shift(cashier.id);
                }
            });
        },
        destroy: function() {
            if (this.config.auto_terminal_shift) {
                this.mpd.balance();
            }
            // Make super call
            PosModelSuper.prototype.initialize.apply(this, arguments);
        },
    });

    // This is the Sixx Status Popup
    var MPDPopupWidget = PopupWidget.extend({
        template:'MPDPopupWidget',
        init: function(pos, options) {
            console.log('in MPD Popup init');
            this._super(pos, options);
            this.pos.bind('change:mpdstatus', function(pos,status){
                // Do update every device state and status text on page
                this.$('.mpd_shift_state_text').html(status.shift_state || "Unbekannt");
                this.$('.mpd_device_status_text').html(status.device_status || "Unbekannt");
                if (status.shift_state=='Open') {
                    this.$('.mpd_open_shift').addClass('oe_hidden');
                    this.$('.mpd_close_shift').removeClass('oe_hidden');
                } else if (status.shift_state=='Closed') {
                    this.$('.mpd_open_shift').removeClass('oe_hidden');
                    this.$('.mpd_close_shift').addClass('oe_hidden');
                } else {
                    this.$('.mpd_open_shift').addClass('oe_hidden');
                    this.$('.mpd_close_shift').addClass('oe_hidden');
                }
            }, this);
        },
        installEventHandler: function(pos) {
            var self = this;
            this.$('.mpd_open_shift').off();
            this.$('.mpd_open_shift').on('click', pos, function(event){
                var cashier = event.data.pos.cashier || event.data.pos.user;
                event.data.pos.mpd.open_shift(cashier.id);
                //self.hide();
            });
            this.$('.mpd_close_shift').off();
            this.$('.mpd_close_shift').on('click', pos, function(event){
                event.data.pos.mpd.close_shift(true);
                //self.hide();
            });
            this.$('.mpd_close_button').off();
            this.$('.mpd_close_button').on('click', pos, function(){
                self.hide();
            });
            this.$('.mpd_balance_button').off();
            this.$('.mpd_balance_button').on('click', pos, function(event){
                event.data.pos.mpd.balance();
                //self.hide();
            });
        },
        show: function(show_options){
            this._super(show_options);
            this.installEventHandler();
        },
        hide: function(){
            if(this.$el){
                this.$el.addClass('oe_hidden');
            }
        },
        loading: function(message) {
            this.$('.content').addClass('oe_hidden');
            this.$('.loading').removeClass('oe_hidden');
            this.$('.loading').html(message);
        },
        loading_done: function() {
            this.$('.content').removeClass('oe_hidden');
            this.$('.loading').addClass('oe_hidden');
        },
    });
    gui.define_popup({name:'mpd_popup', widget: MPDPopupWidget});

    // This is a small dialog to enter a ref number
    var MPDRefWidget = PopupWidget.extend({
        template:'MPDRefWidget',
        callback: null,

        init: function(pos, options) {
            this._super(pos, options);
        },
        installEventHandler: function(pos) {
            var self = this;
            this.$('#mpd_refok_button').on('click', pos, function(event){
                self.hide();
                if (self.callback) {
                    self.callback(self.$('.mpd_refund_ref').val());
                }
            });
            this.$('.number-char').on('click', pos, function(event){
                self.$('.mpd_refund_ref').val(self.$('.mpd_refund_ref').val() + event.currentTarget.textContent);
            });
            this.$('.numpad-clear').on('click', pos, function(event){
                self.$('.mpd_refund_ref').val('');
            });
            this.$('.numpad-backspace').on('click', pos, function(event){
                if (self.$('.mpd_refund_ref').val() > '') {
                    self.$('.mpd_refund_ref').val(self.$('.mpd_refund_ref').val().substr(0, self.$('.mpd_refund_ref').val().length - 1));
                }
            });

        },
        show: function(show_options){
            this._super(show_options);
            if (show_options['callback']) {
                this.callback = show_options['callback'];
            } else {
                this.callback = null;
            }
        },
        hide: function(){
            if(this.$el){
                this.$el.addClass('oe_hidden');
            }
        },
    });
    gui.define_popup({name:'mpd_ref', widget: MPDRefWidget});

    var MPDStatusWidget = chrome.StatusWidget.extend({
        template: 'MPDStatusWidget',
        status: ['connecting','Open','Closed','warning'],
        start: function(){
            var self = this;
            console.log('MPD Install MPDStatus change handler');
            this.pos.bind('change:mpdstatus', function(pos,status){
                if (status.status=='connecting') {
                    self.set_status('connecting');
                } else {
                    // We need to check device status here also
                    if (status.device_available && status.device_available==true) {
                        self.set_status(status.shift_state);
                    } else {
                        self.set_status('warning');  // Removed , status.device_status
                    }
                }
            }, this);
            this.$el.click(function(){
                var cashier = self.pos.cashier || self.pos.user;
                self.pos.gui.popup_instances.mpd_popup.show({terminal: self.pos.get('mpdstatus'), cashier: cashier});
            });
            // Do set initial status value
            self.set_status('connecting');
        },
    });
    /*
    We do register the MPD Status Widget
     */
    chrome.Chrome.prototype.widgets.unshift({
        'name':   'mpd',
        'widget': MPDStatusWidget,
        'append':  '.pos-rightheader'
    });

    /*
    var ChromeSuper = chrome.Chrome;
    chrome.Chrome = chrome.Chrome.extend({
        build_widgets: function() {
            // Super Call
            this._super();
            // Now do add our own widgets
            // The MPD Popup Widget
            this.mpd_popup = new module.MPDPopupWidget(this, {});
            this.mpd_popup.appendTo(this.$el);
            this.mpd_popup.hide();
            this.mpd_popup.installEventHandler(this);
            // The MPD Enter Ref Widget
            this.mpd_ref = new module.MPDRefWidget(this, {});
            this.mpd_ref.appendTo(this.$el);
            this.mpd_ref.hide();
            this.mpd_ref.installEventHandler(this);
            // The MPD Status Widget
            this.mpd_status = new module.MPDStatusWidget(this, {});
            this.mpd_status.appendTo(this.$('.pos-rightheader'));
        },

        destroy: function() {
            var self = this;
            if ((this.pos.config.auto_terminal_shift) && (this.pos.mpd.connected())) {
                this.pos.mpd.shutdown = true;
                this.pos.mpd.balance().then(function() {
                    ChromeSuper.prototype.destroy.call(self, arguments);
                });
            } else {
                ChromeSuper.prototype.destroy.call(self, arguments);
            }
        }

    });
    */

    var DebugWidget = chrome.DebugWidget.extend({
        start: function () {
            // Supercall using prototype
            this._super();
            var self = this;
            // Now do register our own events
            this.$('.button.terminal_setup').click(function(){
                self.pos.mpd.payment_terminal_setup();
            });
            this.$('.button.terminal_initialize').click(function(){
                self.pos.mpd.payment_terminal_initialize();
            });
            this.$('.button.terminal_reboot').click(function(){
                self.pos.mpd.payment_terminal_reboot();
            });
            this.$('.button.terminal_reconnect').click(function(){
                self.pos.mpd.payment_terminal_reconnect();
            });
            this.$('.button.terminal_status').click(function(){
                self.pos.mpd.payment_terminal_status();
            });
        }
    });
    chrome.Chrome.prototype.replace_widget('debug', {
        'name':   'debug',
        'widget': DebugWidget,
        'append':  '.pos-content'
    });

    var ProxyDeviceSuper = devices.ProxyDevice;
    devices.ProxyDevice = devices.ProxyDevice.extend({
        // ask for the cashbox (the physical box where you store the cash) to be opened
        open_cashbox: function(force){
            if (force) {
                return ProxyDeviceSuper.prototype.open_cashbox.apply(this, arguments);
            }
            // Here - get current order - check payment statements - if there is any statement with open_cashdrawer - then open it - else - let it closed
            var currentOrder = this.pos.get('selectedOrder');
            var plines = currentOrder.get('paymentLines').models;
            var open_cashdrawer = false;
            for (var i = 0; i < plines.length; i++) {
                if (plines[i].cashregister.journal.open_cashdrawer) {
                    open_cashdrawer = true;
                    break;
                }
            }
            if (open_cashdrawer) {
                // Super Call
                return ProxyDeviceSuper.prototype.open_cashbox.apply(this, arguments);
            }
        },
    });

    /*
    module.ActionBarWidget = module.ActionBarWidget.extend({
        init: function(parent, options){
            this.parent = parent;
            this._super(parent, options);
        },
        add_new_button: function(button_options){
            var self = this;
            // Modify cashbox button click handler
            if ((button_options['name']) && (button_options['name']=='cashbox')) {
                button_options['click'] = function() {
                    // Add force open option
                    self.parent.pos.proxy.open_cashbox(true);
                }
            }
            return this._super(button_options);
        },
    });
    */
});