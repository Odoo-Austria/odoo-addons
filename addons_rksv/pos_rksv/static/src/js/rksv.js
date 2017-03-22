odoo.define('pos_rksv.rksv', function (require) {
    "use strict";

    var core = require('web.core');
    // We do require the signature model and collection
    require('pos_rksv.models');
    var models = require('point_of_sale.models');
    var QWeb = core.qweb;
    var Model = require('web.DataModel');
    var _t = core._t;

    /* RKSV Core Extension */

    var RKSV = core.Class.extend({
        timeout: {timeout: 7500},
        proxy_informed: true,
        inform_running: false,
        start_receipt_in_progress: false,
        start_receipt_failed: false,
        year_receipt_in_progress: false,
        month_receipt_in_progress: false,
        statuses: {
            'posbox': false,
            'kasse': false,
            'signatureinheit': false,
            'rksv': false,
            'rksv_products_exists': false
        },
        init: function (attributes) {
            console.log('RKSV init got called !');
            this.pos = attributes.pos;
            this.proxy = attributes.proxy;
            this.signature = null;
            this.last_proxy_status = null;
            var self = this;
            this.pos.bind('change:signature', function(pos, signature) {
                if (signature) {
                    self.inform_proxy(signature);
                }
            });
            // Bind to signature status changes
            if (this.pos.signatures){
                this.pos.signatures.bind('add remove change', function(signature) {
                    if (!signature.isActive(self.pos))
                    // Ignore this update if it does not belong to the active signature
                        return;
                    if (signature.get('bmf_last_status') == 'IN_BETRIEB') {
                        self.statuses['signatureinheit'] = true;
                    } else {
                        self.statuses['signatureinheit'] = false;
                    }
                });
            }
            // Bind on RK BMF Status change
            this.pos.bind('change:bmf_status_rk', function(pos, status) {
                if (status.success) {
                    self.statuses['kasse'] = true;
                } else {
                    self.statuses['kasse'] = false;
                }
            });

            if (this.proxy){
                this.proxy.on('change:status', this, function (eh, status) {
                    self.last_proxy_status = status.newValue;
                    // Do check posbox and rksv status
                    if (status.newValue.status == "connected") {
                        self.statuses['posbox'] = true;
                    } else {
                        self.statuses['posbox'] = false;
                    }
                    // Check RKSV Status
                    if (status.newValue.status === 'connected' && (!(self.pos.config.state === "failure"  || self.pos.config.state === "inactive"))) {
                        var rksvstatus = status.newValue.drivers.rksv ? status.newValue.drivers.rksv.status : false;
                        // Connected or setup are ok - setup means we are connected - but we need some additional love...
                        if ((rksvstatus == 'connected') || (rksvstatus == 'setup')) {
                            self.statuses['rksv'] = true;
                        } else {
                            self.statuses['rksv'] = false;
                        }
                        // Extra check here for a valid cashregisterid
                        if ((!self.pos.config.cashregisterid) || (self.pos.config.cashregisterid.trim() == "")) {
                            self.statuses['rksv'] = false;
                        }
                    } else {
                        self.statuses['rksv'] = false;
                    }
                    // Extra check here for a valid cashregisterid
                    if ((!self.pos.config.cashregisterid) || (self.pos.config.cashregisterid.trim() == "")) {
                        self.statuses['rksv'] = false;
                    }
                    // Check for month product
                    if ((self.statuses['rksv_products_exists']===false)
                        && (self.pos.config.start_product_id) && (self.pos.db.get_product_by_id(self.pos.config.start_product_id[0]))
                        && (self.pos.config.month_product_id) && (self.pos.db.get_product_by_id(self.pos.config.month_product_id[0]))
                        && (self.pos.config.year_product_id) && (self.pos.db.get_product_by_id(self.pos.config.year_product_id[0]))) {
                        self.statuses['rksv_products_exists'] = true;
                    }
                    // Check status reponse from proxy - which signatures does the proxy has available ?
                    if ((status.newValue.drivers.rksv) && (status.newValue.drivers.rksv.cards)) {
                        // Do create Backbone Signature Models out of this
                        var signatures = new Array();
                        var currentSignature = self.pos.get('signature');
                        $.each(status.newValue.drivers.rksv.cards, function(serial, signature) {
                            var newSignature = new models.Signature(signature.cardinfo);
                            signatures.push(newSignature);
                            // Check if this is an active signature - forward status if it is
                            if ((currentSignature) && (currentSignature.get('serial') == newSignature.get('serial'))) {
                                currentSignature.set({
                                    'bmf_last_status': signature.cardinfo['bmf_last_status']
                                })
                            }
                        });
                        self.pos.signatures.set(signatures);
                    }
                    // Here do check for the start receipt flag - if it is set - then generate the start receipt for this cash register !
                    if ((self.start_receipt_in_progress === false) &&
                        (self.all_ok()) &&
                        (status.newValue.drivers.rksv) &&
                        (status.newValue.drivers.rksv.start_receipt_needed !== undefined) &&
                        (status.newValue.drivers.rksv.start_receipt_needed === true)) {
                        self.create_start_receipt();
                    }
                    if ((self.start_receipt_in_progress === false) &&
                        (self.all_ok()) &&
                        (status.newValue.drivers.rksv) &&
                        (status.newValue.drivers.rksv.start_receipt_needed !== undefined) &&
                        (status.newValue.drivers.rksv.start_receipt_needed === false) &&
                        (status.newValue.drivers.rksv.has_valid_start_receipt !== undefined) &&
                        (status.newValue.drivers.rksv.has_valid_start_receipt === false)) {
                        self.start_receipt_in_progress = true;
                        self.bmf_register_start_receipt_rpc().then(
                            function done() {
                                self.start_receipt_in_progress = false;
                                console.log("Startbeleg wurde erfolgreich eingereicht!");
                            },
                            function failed(message) {
                                self.start_receipt_in_progress = false;
                                // Set setup state
                                self.pos.set('cashbox_mode', 'setup');
                                // Display error popup for user
                                self.pos.gui.show_popup('error',{
                                    'title': _t("Fehler"),
                                    'body': message
                                });
                            }
                        )
                    }
                    if (
                        (self.all_ok()) &&
                        (status.newValue.drivers.rksv) &&
                        (status.newValue.drivers.rksv.start_receipt_needed !== undefined) &&
                        (status.newValue.drivers.rksv.start_receipt_needed === false)
                    ){
                        // Here do check for the year receipt flag - if it is set - then generate the year receipt for this cash register !
                        if ((self.year_receipt_in_progress === false) &&
                            (self.all_ok()) &&
                            (status.newValue.drivers.rksv) &&
                            (status.newValue.drivers.rksv.year_receipt_needed) &&
                            (status.newValue.drivers.rksv.year_receipt_needed === true)) {
                            self.create_year_receipt();
                        }
                        // Here do check for the month receipt flag - if it is set - then generate the month receipt for this cash register !
                        if ((self.month_receipt_in_progress === false) &&
                            (self.all_ok()) &&
                            (status.newValue.drivers.rksv) &&
                            (status.newValue.drivers.rksv.month_receipt_needed) &&
                            (status.newValue.drivers.rksv.month_receipt_needed === true)) {
                            self.create_month_receipt();
                        }
                    }
                });
            }
        },
        auto_receipt_needed: function() {
            // If we miss rksv status - then something else is already problematic - no need to check further
            if ((!this.last_proxy_status) || (!this.last_proxy_status.drivers) || (!this.last_proxy_status.drivers.rksv))
                return false;
            if ((this.last_proxy_status.drivers.rksv.start_receipt_needed !== undefined) && (this.last_proxy_status.drivers.rksv.start_receipt_needed === true))
                return true;
            if ((this.last_proxy_status.drivers.rksv.has_valid_start_receipt !== undefined) && (this.last_proxy_status.drivers.rksv.has_valid_start_receipt === false))
                return true;
            if ((this.last_proxy_status.drivers.rksv.year_receipt_needed !== undefined) && (this.last_proxy_status.drivers.rksv.year_receipt_needed === true))
                return true;
            if ((this.last_proxy_status.drivers.rksv.month_receipt_needed !== undefined) && (this.last_proxy_status.drivers.rksv.month_receipt_needed === true))
                return true;
            return false;
        },
        check_proxy_connection: function(){
            if (this.pos.proxy.connection === null) {
                console.log('No Proxy Connection available!');
                return false;
            }
            return true;
        },
        proxy_rpc_call: function(url, add_params){
            var params = Object.assign(this.get_default_params(), add_params);
            console.log('RPC Call URL: ', url);
            console.log('RPC Call Params: ', params);
            return this.pos.proxy.connection.rpc(url, params);
        },
        get_default_params: function(){
            return {
                'test_mode': this.pos.config.bmf_test_mode
            }
        },
        get_bmf_credentials: function(){
            return {
                'tid': this.pos.company.bmf_tid,
                'benid': this.pos.company.bmf_benid,
                'pin': this.pos.company.bmf_pin
            }
        },
        get_rksv_info: function(){
            return {
                'kassenidentifikationsnummer': this.pos.config.cashregisterid,
                'atu': this.pos.company.vat,
                'hersteller_atu': this.pos.company.bmf_hersteller_atu
            }
        },
        all_ok: function() {
            var combined_status = true;
            $.each(this.statuses, function (key, status) {
                if (!status) {
                    combined_status = false;
                }
            });
            return combined_status;
        },
        can_sign: function() {
            return  this.statuses['posbox'] &&
                    this.statuses['kasse'] &&
                    this.statuses['signatureinheit'] &&
                    this.statuses['rksv'];
        },
        print_order: function(order) {
            var self = this;
            if(self.pos.config.iface_print_via_proxy){
                var env = {
                    widget:  this,
                    order: order,
                    receipt: order.export_for_printing(),
                    paymentlines: order.get_paymentlines()
                };
                self.pos.proxy.print_receipt(QWeb.render('XmlReceipt',env));
            } else{
                self.pos.gui.show_screen('receipt')
            }
        },
        rksv_reprint_special_receipt: function(type, title) {
            var self = this;
            if (!self.check_proxy_connection()) {
                self.pos.gui.show_popup('error',{
                    'title': _t("Fehler"),
                    'body': "PosBox Verbindung wird für diese Funktion benötigt !"
                });
                return;
            }
            // Get minimal data needed for printing from the posbox
            self.proxy_rpc_call(
                '/hw_proxy/get_'+type+'_receipt',
                self.get_rksv_info(),
                self.timeout
            ).then(
                function done(response) {
                    if (response.success == false) {
                        self.pos.gui.show_popup('error',{
                            'title': _t("Fehler"),
                            'body': response.message
                        });
                    } else {
                        // in response we should have the needed data to reprint - we assume to have a pos printer here
                        var env = {
                            'title': title,
                            'receipt': response.receipt
                        };
                        self.pos.proxy.print_receipt(QWeb.render('RKSVReceipt',env));
                    }
                },
                function failed() {
                    self.pos.gui.show_popup('error',{
                        'title': _t("Fehler"),
                        'body': "Fehler bei der Kommunikation mit der PosBox!"
                    });
                }
            );
        },
        create_dummy_order: function(product_id, reference) {
            // Get current order
            var order = this.pos.get_order();
            // Check if it is empty
            if (!order.is_empty()) {
                // Is not empty - so create new empty order
                // Create dummy
                this.pos.add_new_order();
                // And get it
                order = this.pos.get_order();
            }
            // With Product or not
            if (product_id) {
                var product = this.pos.db.get_product_by_id(product_id);
                // Add product to order
                order.add_product(product, {price: 0});
                // Add reference to order line
                order.selected_orderline.set_product_reference(reference);
            }
            // return it
            return order;
        },
        create_start_receipt: function() {
            var self = this;
            this.start_receipt_in_progress = true;
            // Create a new dummy order with the start product
            var order = this.create_dummy_order(this.pos.config.start_product_id[0], this.pos.config.cashregisterid);
            // Mark it as month receipt order type
            order.start_receipt = true;
            // Sign Order
            this.pos.push_order(order).then(
                function done() {
                    self.print_order(order);
                    order.finalize();
                    self.start_receipt_in_progress = false;
                },
                function failed() {
                    self.start_receipt_in_progress = false;
                }
            );
        },
        create_year_receipt: function() {
            var self = this;
            this.year_receipt_in_progress = true;
            var year = new Date().getFullYear();
            // Create a new dummy order with the year product
            var order = this.create_dummy_order(this.pos.config.year_product_id[0], year);
            // Mark it as month receipt order type
            order.year_receipt = true;
            // Sign Order
            this.pos.push_order(order).then(
                function done() {
                    self.print_order(order);
                    order.finalize();
                    self.year_receipt_in_progress = false;
                },
                function failed() {
                    self.year_receipt_in_progress = false;
                }
            );
        },
        create_month_receipt: function() {
            var self = this;
            this.month_receipt_in_progress = true;
            // Create a new order
            var year_month = new Date().getFullYear() + "-" + ((new Date().getMonth()) + 1);
            // Create a new dummy order with the start product
            var order = this.create_dummy_order(this.pos.config.month_product_id[0], year_month);
            // Mark it as month receipt order type
            order.month_receipt = true;
            // Sign Order
            this.pos.push_order(order).then(
                function done() {
                    self.print_order(order);
                    order.finalize();
                    self.month_receipt_in_progress = false;
                },
                function failed() {
                    self.month_receipt_in_progress = false;
                }
            );
        },
        rksv_create_null_receipt: function() {
            var self = this;
            // Create a new dummy order with no product
            var order = this.create_dummy_order(null);
            // Sign Order
            this.pos.push_order(order).then(
                function done() {
                    self.print_order(order);
                    order.finalize();
                },
                function failed() {
                    console.log('Failed to generate null receipt !');
                }
            );
        },
        set_signature: function (serial) {
            var self = this;
            // We also do provide a deferred here for the caller
            var deferred = $.Deferred();
            console.log('RKSV set signature got called !');
            if (!self.check_proxy_connection()) {
                console.log('we cannot set the signature without proxy connection !');
                deferred.reject(_t('Keine Verbindung mit der PosBox ist möglich'));
                return deferred;
            }
            this.inform_running = true;
            // We do generate a dummy order, to signal the cashbox the new signature
            var order = this.create_dummy_order(null, this.pos.config.cashregisterid);
            // Mark it as null receipt order type
            order.null_receipt = true;
            order.set_serial = serial;
            // Sign Order
            this.pos.push_order(order).then(
                function done() {
                    self.print_order(order);
                    self.pos.get('selectedOrder').destroy({'reason':'system'});
                    self.proxy_informed = true;
                    self.inform_running = false;
                    var mode = self.pos.get('cashbox_mode');
                    if (mode == "signature_failed") {
                        // Set and signal active mode
                        self.pos.set('cashbox_mode', 'active');
                    }
                    var config = new Model('pos.config');
                    config.call('set_provider', [serial, self.pos.config.id]).then(
                        function done(result) {
                            if (!result['success']) {
                                self.pos.gui.show_popup('error',{
                                    'title': _t("RKSV Fehler"),
                                    'body': result['message']
                                });
                                deferred.reject(result['message']);
                            } else {
                                // To be correct - we do resolve the deferred here - even if we do reload
                                deferred.resolve();
                                location.reload();
                            }
                        },
                        function failed(message) {
                            self.pos.gui.show_popup('error',{
                                'title': _t("Fehler"),
                                'body': _t("Fehler bei der Kommunikation mit Odoo, keine Internet Verbindung vorhhanden ?")
                            });
                            deferred.reject(_t("Fehler bei der Kommunikation mit Odoo, keine Internet Verbindung vorhhanden ?"));
                        }
                    );
                },
                function failed(message) {
                    self.inform_running = false;
                    self.pos.gui.show_popup('error',{
                        'title': _t("RKSV Fehler"),
                        'body':  message
                    });
                    deferred.reject(message);
                }
            );
            return deferred;
        },
        inform_proxy: function (signature) {
            var self = this;
            this.signature = signature;
            console.log('As soon as possible we have to inform the proxy about the signature');
            this.pos.proxy.on('change:status', this, function (eh, status) {
                if ((status.newValue.status == 'connected') && (!self.proxy_informed) && (!self.inform_running) && (self.signature)) {
                    self.inform_running = true;
                    self.set_signature(self.signature);
                }
            });
        },
        fa_first_report: function() {
            this.pos.gui.show_popup('rksv_fa_widget');
        },
        delete_start_receipt: function() {
            var self = this;
            var op_popup = this.pos.gui.popup_instances.rksv_popup_widget;
            op_popup.show({}, 'Start Beleg löschen', 'Löschen');
            // First - do disable old event handlers
            op_popup.$('.execute_button').off();
            // Then install new click handler
            op_popup.$('.execute_button').click(function() {
                op_popup.loading('Löschen des Startbeleges');
                if (self.check_proxy_connection()){
                    self.proxy_rpc_call(
                        '/hw_proxy/delete_start_receipt',
                        Object.assign(self.get_rksv_info()),
                        self.timeout
                    ).then(
                        function done(response) {
                            if (response.success == false) {
                                op_popup.failure(response.message);
                            } else {
                                op_popup.success(response.message);
                                // Do set the cashbox_mode to setup
                                self.pos.set('cashbox_mode', 'setup');
                            }
                        },
                        function failed() {
                            op_popup.failure("Fehler bei der Kommunikation mit der PosBox!");
                        }
                    );
                } else {
                    op_popup.failure("Fehler bei der Kommunikation mit der PosBox (Proxy nicht initialisiert)!");
                }
                op_popup.$('.execute_button').hide();
                op_popup.$('.close_button').show();
            });
        },
        start_receipt_set_valid: function() {
            if (!this.pos.config.bmf_test_mode) {
                this.pos.gui.show_popup('error',{
                    'title': _t("Fehler"),
                    'body': _t("Manuelles validieren des Start Beleges ist nur im Test Modus erlaubt")
                });
                return;
            }
            var self = this;
            var op_popup = this.pos.gui.popup_instances.rksv_popup_widget;
            op_popup.show({}, 'Start Beleg valid setzen', 'Valid');
            // First - do disable old event handlers
            op_popup.$('.execute_button').off();
            // Then install new click handler
            op_popup.$('.execute_button').click(function() {
                op_popup.loading('Setze Valid Flag für Start Beleg');
                if (self.check_proxy_connection()){
                    self.proxy_rpc_call(
                        '/hw_proxy/valid_start_receipt',
                        Object.assign(self.get_rksv_info()),
                        self.timeout
                    ).then(
                        function done(response) {
                            if (response.success == false) {
                                op_popup.failure(response.message);
                            } else {
                                op_popup.success(response.message);
                                // Do set the cashbox_mode to active
                                self.pos.set('cashbox_mode', 'active');
                            }
                        },
                        function failed() {
                            op_popup.failure("Fehler bei der Kommunikation mit der PosBox!");
                        }
                    );
                } else {
                    op_popup.failure("Fehler bei der Kommunikation mit der PosBox (Proxy nicht initialisiert)!");
                }
                op_popup.$('.execute_button').hide();
                op_popup.$('.close_button').show();
            });
        },
        rk_ausfalls_modus: function() {
            var self = this;
            var op_popup = this.pos.gui.popup_instances.rksv_popup_widget;
            op_popup.show({}, 'Kasse Signatur Ausfall Modus aktivieren', 'Ausfallmodus');
            // First - do disable old event handlers
            op_popup.$('.execute_button').off();
            // Then install new click handler
            op_popup.$('.execute_button').click(function() {
                op_popup.loading('Ausfallmodus aktivieren');
                if (self.check_proxy_connection()){
                    self.proxy_rpc_call(
                        '/hw_proxy/cashbox_se_failed',
                        Object.assign(self.get_rksv_info()),
                        self.timeout
                    ).then(
                        function done(response) {
                            if (response.success == false) {
                                op_popup.failure(response.message);
                            } else {
                                op_popup.success(response.message);
                                // Do set the wcashbox_mode to signature_failed
                                self.pos.set('cashbox_mode', 'signature_failed');
                            }
                        },
                        function failed() {
                            op_popup.failure("Fehler bei der Kommunikation mit der PosBox!");
                        }
                    );
                } else {
                    op_popup.failure("Fehler bei der Kommunikation mit der PosBox (Proxy nicht initialisiert)!");
                }
                op_popup.$('.execute_button').hide();
                op_popup.$('.close_button').show();
            });
        },
        register_cashbox: function() {
            var self = this;
            var op_popup = this.pos.gui.popup_instances.rksv_popup_widget;
            op_popup.show({}, 'Kasse mit PosBox verknüpfen', 'Verknüpfen');
            // First - do disable old event handlers
            op_popup.$('.execute_button').off();
            // Then install new click handler
            op_popup.$('.execute_button').click(function() {
                op_popup.loading('Mit PosBox verknüpfen');
                if (self.check_proxy_connection()){
                    var local_params = {
                        'name': self.pos.config.name
                    };
                    self.proxy_rpc_call(
                        '/hw_proxy/register_cashbox',
                        Object.assign(local_params, self.get_rksv_info()),
                        self.timeout
                    ).then(
                        function done(response) {
                            if (response.success == false) {
                                op_popup.failure(response.message);
                                // Request a status update here
                                self.pos.rksv.update_bmf_rk_status();
                            } else {
                                op_popup.success(response.message);
                                self.pos.set('cashbox_mode', 'active');
                                // Request a status update here
                                self.pos.rksv.update_bmf_rk_status();
                            }
                        },
                        function failed() {
                            op_popup.failure("Fehler bei der Kommunikation mit der PosBox!");
                        }
                    );
                } else {
                    op_popup.failure("Fehler bei der Kommunikation mit der PosBox (Proxy nicht initialisiert)!");
                }
                op_popup.$('.execute_button').hide();
                op_popup.$('.close_button').show();
            });
        },
        bmf_kasse_registrieren: function() {
            var self = this;
            var op_popup = this.pos.gui.popup_instances.rksv_popup_widget;
            op_popup.show({}, 'Kasse beim BMF registrieren', 'Registrieren');
            // First - do disable old event handlers
            op_popup.$('.execute_button').off();
            // Then install new click handler
            op_popup.$('.execute_button').click(function() {
                op_popup.loading('Daten an BMF übermitteln');
                if (self.check_proxy_connection()){
                    var local_params = {
                        'name': self.pos.config.name
                    };
                    self.proxy_rpc_call(
                        '/hw_proxy/rksv_kasse_registrieren',
                        Object.assign(local_params, self.get_rksv_info(), self.get_bmf_credentials()),
                        self.timeout
                    ).then(
                        function done(response) {
                            if (response.success == false) {
                                op_popup.failure(response.message);
                                // Request a status update here
                                self.pos.rksv.update_bmf_rk_status();
                            } else {
                                op_popup.success(response.message);
                                // Request a status update here
                                self.pos.rksv.update_bmf_rk_status();
                            }
                        },
                        function failed() {
                            op_popup.failure("Fehler bei der Kommunikation mit der PosBox!");
                        }
                    );
                } else {
                    op_popup.failure("Fehler bei der Kommunikation mit der PosBox (Proxy nicht initialisiert)!");
                }
                op_popup.$('.execute_button').hide();
                op_popup.$('.close_button').show();
            });
        },
        bmf_status_rpc_call: function () {
            var self = this;
            return self.proxy_rpc_call(
                '/hw_proxy/status_kasse',
                Object.assign(self.get_rksv_info(), self.get_bmf_credentials()),
                self.timeout
            );
        },
        // Do return true if we have bmf auth data which could be valid
        bmf_auth_data: function() {
            if ((this.pos.company.bmf_tid) && (this.pos.company.bmf_tid.length > 0) &&
                    (this.pos.company.bmf_benid) && (this.pos.company.bmf_benid.length > 0) &&
                    (this.pos.company.bmf_pin) && (this.pos.company.bmf_pin.length > 0) &&
                    (this.pos.company.bmf_hersteller_atu) && (this.pos.company.bmf_hersteller_atu.length > 0))
                return true;
            else
                return false;
        },
        update_bmf_rk_status: function() {
            var self = this;
            // Chck if we do have an active proxy connection - if not - then not update is possible
            if (!self.check_proxy_connection()) {
                self.pos.set('bmf_status_rk', {
                    'success': false,
                    'message': "Abfrage nicht möglich, PosBox ist nicht erreichbar !"
                });
                return false;
            }
            // Check if the user provided us with bmf auth data - if not - then we can't read data from bmf
            if (!this.bmf_auth_data()) {
                self.pos.set('bmf_status_rk', {
                    'success': false,
                    'message': "Keine BMF Anmeldedaten hinterlegt, Status Abfrage ist nicht möglich !"
                });
            } else {
                if (self.check_proxy_connection()){
                    this.bmf_status_rpc_call().then(
                        function done(response) {
                            self.pos.set('bmf_status_rk', response);
                        },
                        function failed() {
                            self.pos.set('bmf_status_rk', {
                                'success': false,
                                'message': "Fehler bei der Kommunikation mit der PosBox!"
                            });
                        }
                    );
                } else {
                    self.pos.set('bmf_status_rk', {
                        'success': false,
                        'message': "Fehler bei der Kommunikation mit der PosBox (Proxy nicht initialisiert)!"
                    });
                }
            }
        },
        // Gets called from the debug widget - for automatic status update use update_bmf_rk_status function !
        bmf_status_rk: function() {
            if (!this.bmf_auth_data()) {
                // TODO: Display error message here
                return;
            }
            var self = this;
            var op_popup = this.pos.gui.popup_instances.rksv_popup_widget;
            op_popup.$('.execute_button').off();
            op_popup.show({}, 'Status der Kasse abfragen', 'Abfrage starten');
            op_popup.$('.execute_button').click(function() {
                if (self.check_proxy_connection()){
                    self.bmf_status_rpc_call().then(
                        function done(response) {
                            self.pos.set('bmf_status_rk', response);
                            if (response.success == false) {
                                op_popup.failure(response.message);
                            } else {
                                op_popup.success(response.message);
                            }
                        },
                        function failed() {
                            self.pos.set('bmf_status_rk', {
                                'success': false,
                                'message': "Fehler bei der Kommunikation mit der PosBox!"
                            });
                            op_popup.failure("Fehler bei der Kommunikation mit der PosBox!");
                        }
                    );
                } else {
                    self.pos.set('bmf_status_rk', {
                        'success': false,
                        'message': "Fehler bei der Kommunikation mit der PosBox (Proxy nicht initialisiert)!"
                    });
                    op_popup.failure("Fehler bei der Kommunikation mit der PosBox (Proxy nicht initialisiert)!");
                }
            });
        },
        rksv_reset_dep: function() {
            var self = this;
            var sprovider_popup = this.pos.gui.popup_instances.rksv_popup_widget;
            sprovider_popup.show({}, 'DEP zurücksetzen', 'Zurücksetzen');
            sprovider_popup.$('.execute_button').click(function() {
                sprovider_popup.loading('DEP wird zurückgesetzt');
                if (self.check_proxy_connection()){
                    self.proxy_rpc_call(
                        '/hw_proxy/rksv_reset_dep',
                        Object.assign(self.get_rksv_info()),
                        self.timeout).then(
                        function done(response) {
                            if (response.success == false) {
                                sprovider_popup.failure(response.message);
                            } else {
                                sprovider_popup.success(response.message);
                            }
                        },
                        function failed() {
                            sprovider_popup.failure("Fehler bei der Kommunikation mit der PosBox!");
                        }
                    );
                } else {
                    sprovider_popup.failure("Fehler bei der Kommunikation mit der PosBox (Proxy nicht initialisiert)!");
                }
                sprovider_popup.$('.execute_button').hide();
                sprovider_popup.$('.close_button').show();
            });
        },
        rksv_write_dep_crypt_container: function() {
            var self = this;
            var sprovider_popup = this.pos.gui.popup_instances.rksv_popup_widget;
            sprovider_popup.show({}, 'Crypt und DEP', 'Erzeugen');
            sprovider_popup.$('.execute_button').click(function() {
                sprovider_popup.loading('Es wird der Crypt Container und der DEP Export erzeugt');
                if (self.check_proxy_connection()){
                    self.proxy_rpc_call(
                        '/hw_proxy/rksv_write_dep_crypt_container',
                        Object.assign(self.get_rksv_info()),
                        self.timeout).then(
                        function done(response) {
                            if (response.success == false) {
                                sprovider_popup.failure(response.message);
                            } else {
                                sprovider_popup.success(response.message);
                            }
                        },
                        function failed() {
                            sprovider_popup.failure("Fehler bei der Kommunikation mit der PosBox!");
                        }
                    );
                } else {
                    sprovider_popup.failure("Fehler bei der Kommunikation mit der PosBox (Proxy nicht initialisiert)!");
                }
                sprovider_popup.$('.execute_button').hide();
                sprovider_popup.$('.close_button').show();
            });
        },
        bmf_sprovider_registrieren: function(serial) {
            var self = this;
            var sprovider_popup = this.pos.gui.popup_instances.rksv_popup_widget;
            sprovider_popup.show({}, 'Signatureinheit registrieren', 'BMF melden', true);
            // First - do remove old event handlers
            sprovider_popup.$('.execute_button').off();
            // And do install our own event handler
            sprovider_popup.$('.execute_button').click(function() {
                sprovider_popup.loading('Daten an BMF übermitteln');
                var local_params = {
                    'kundeninfo': sprovider_popup.$('.kundeninfo').val(),
                    'serial': serial
                };
                if (self.check_proxy_connection()){
                    self.proxy_rpc_call(
                        '/hw_proxy/rksv_signatureinheit_registrieren',
                        Object.assign(local_params, self.get_rksv_info(), self.get_bmf_credentials()),
                        self.timeout
                    ).then(
                        function done(response) {
                            if (response.success == false) {
                                sprovider_popup.failure(response.message);
                            } else {
                                sprovider_popup.success("Signatureinheit wurde beim BMF registriert !");
                            }
                        },
                        function failed() {
                            sprovider_popup.failure("Fehler bei der Kommunikation mit der PosBox!");
                        }
                    );
                } else {
                    sprovider_popup.failure("Fehler bei der Kommunikation mit der PosBox (Proxy nicht initialisiert)!");
                }
            });
        },
        bmf_sprovider_ausfall: function(serial) {
            var signature = this.pos.signatures.get(serial);
            var self = this;
            var sprovider_ausfall_popup = this.pos.gui.popup_instances.rksv_sprovider_ausfall_popup;
            sprovider_ausfall_popup.show({}, 'Ausfall der SE melden', 'Ausfall', true);
            // Uninstall previous click handler
            sprovider_ausfall_popup.$('.execute_button').off();
            // Install my click handler
            sprovider_ausfall_popup.$('.execute_button').click(function() {
                sprovider_ausfall_popup.loading('Ausfall beim BMF melden');
                var local_params = {
                    'name': self.pos.config.name,
                    'serial': serial,
                    'kundeninfo': sprovider_ausfall_popup.$('.ausfall-kundeninfo').val(),
                    'begruendung': sprovider_ausfall_popup.$('.ausfall-begruendung').val()
                };
                if (self.check_proxy_connection()){
                    self.proxy_rpc_call(
                        '/hw_proxy/ausfall_signatureinheit',
                        Object.assign(local_params, self.get_rksv_info(), self.get_bmf_credentials()),
                        self.timeout
                    ).then(
                        function done(response) {
                            if (response.success == false) {
                                sprovider_ausfall_popup.failure(response.message);
                                if (signature) {
                                    signature.set({
                                        'bmf_status': false,
                                        'bmf_message': 'Melden des Ausfalles ist fehlgeschlagen'
                                    });
                                }
                            } else {
                                sprovider_ausfall_popup.success("Ausfall der SE wurde beim BMF gemeldet !");
                                if (signature) {
                                    signature.set({
                                        'bmf_status': true,
                                        'bmf_message': 'Ausfall der Signatureinheit erfolgreich gemeldet',
                                        'bmf_last_status': 'AUSFALL'
                                    });
                                }
                            }
                        },
                        function failed() {
                            sprovider_ausfall_popup.failure("Fehler bei der Kommunikation mit der PosBox!");
                        }
                    );
                } else {
                    sprovider_ausfall_popup.failure("Fehler bei der Kommunikation mit der PosBox (Proxy nicht initialisiert)!");
                }
                sprovider_ausfall_popup.$('.execute_button').hide();
                sprovider_ausfall_popup.$('.close_button').show();
            });
        },
        bmf_sprovider_wiederinbetriebnahme: function(serial) {
            var signature = this.pos.signatures.get(serial);
            if (!signature) {
                console.log('Unbekannte SE Seriennummer !');
                return;
            }
            var self = this;
            var sprovider_wiederinbetriebnahme_popup = this.pos.gui.popup_instances.rksv_popup_widget;
            sprovider_wiederinbetriebnahme_popup.show({}, 'Wiederinbetriebnahme der SE melden', 'Betrieb melden', true);
            // Do remove old event handlers
            sprovider_wiederinbetriebnahme_popup.$('.execute_button').off();
                // Install our own event handler
            sprovider_wiederinbetriebnahme_popup.$('.execute_button').click(function() {
                sprovider_wiederinbetriebnahme_popup.loading('Wiederinbetriebnahme der SE an BMF melden');
                var local_params = {
                    'name': self.pos.config.name,
                    'kundeninfo': sprovider_wiederinbetriebnahme_popup.$('.kundeninfo').val(),
                    'serial': serial
                };
                if (self.check_proxy_connection()){
                    self.proxy_rpc_call(
                        '/hw_proxy/wiederinbetriebnahme_signatureinheit',
                        Object.assign(local_params, self.get_rksv_info(), self.get_bmf_credentials()),
                        self.timeout).then(
                        function done(response) {
                            if (response.success == false) {
                                sprovider_wiederinbetriebnahme_popup.failure(response.message);
                                signature.set({
                                    'bmf_status': false,
                                    'bmf_message': 'Melden der Wiederinbetriebnahme ist fehlgeschlagen'
                                });
                            } else {
                                sprovider_wiederinbetriebnahme_popup.success("Wiederinbetriebnahme gemeldet");
                                signature.set({
                                    'bmf_status': true,
                                    'bmf_message': 'Wiederinbetriebnahme erfolgreich gemeldet',
                                    'bmf_last_status': 'IN_BETRIEB'
                                });
                            }
                        },
                        function failed() {
                            sprovider_wiederinbetriebnahme_popup.failure("Fehler bei der Kommunikation mit der PosBox!");
                        }
                    );
                } else {
                    sprovider_wiederinbetriebnahme_popup.failure("Fehler bei der Kommunikation mit der PosBox (Proxy nicht initialisiert)!");
                }
                sprovider_wiederinbetriebnahme_popup.$('.execute_button').hide();
                sprovider_wiederinbetriebnahme_popup.$('.close_button').show();
            });
        },
        bmf_sprovider_status_rpc_call: function(serial) {
            var self = this;
            var local_params = {
                'name': this.pos.config.name,
                'serial': serial
            };
            return self.proxy_rpc_call(
                '/hw_proxy/status_signatureinheit',
                Object.assign(local_params, self.get_rksv_info(), self.get_bmf_credentials()),
                self.timeout
            );
        },
        bmf_sprovider_status: function(serial) {
            var signature = this.pos.signatures.get(serial);
            if (!signature) {
                console.log('Unbekannte SE Seriennummer !');
                return;
            }
            var self = this;
            var sprovider_status_popup = this.pos.gui.popup_instances.rksv_popup_widget;
            sprovider_status_popup.show({}, 'Status der Signatureinheit', 'Status abfragen', false);
            // Do remove old event handlers
            sprovider_status_popup.$('.execute_button').off();
            // Install our own event handler
            sprovider_status_popup.$('.execute_button').click(function() {
                sprovider_status_popup.loading('Status vom BMF Abfragen');
                signature.try_refresh_status(self.pos).then(
                    function done(response) {
                        if (response.success == false) {
                            sprovider_status_popup.failure(response.message);
                        } else {
                            sprovider_status_popup.success("Status: " + response.status.status);
                        }
                    },
                    function failed(message) {
                        sprovider_status_popup.failure(message);
                    }
                );
                sprovider_status_popup.$('.execute_button').hide();
                sprovider_status_popup.$('.close_button').show();
            });
        },
        bmf_register_start_receipt_rpc: function(){
            var self = this;
            var proxyDeferred = $.Deferred();
            if (!self.check_proxy_connection()) {
                proxyDeferred.reject("Keine Verbindung zur PosBox, Status kann nicht abgefragt werden !");
                return proxyDeferred;
            }
            self.proxy_rpc_call(
                '/hw_proxy/rksv_startbeleg_registrieren',
                Object.assign(self.get_rksv_info(), self.get_bmf_credentials()),
                self.timeout
            ).then(
                    function done(response) {
                        if (response.success === true) {
                            proxyDeferred.resolve(response);
                        } else {
                            proxyDeferred.reject(response.message);
                        }
                    },
                    function failed() {
                        proxyDeferred.reject("Fehler bei der Kommunikation mit der PosBox!");
                    }
            );
            return proxyDeferred;
        },
        bmf_register_start_receipt: function() {
            var self = this;
            var op_popup = this.pos.gui.popup_instances.rksv_popup_widget;
            op_popup.$('.execute_button').off();
            op_popup.show({}, 'Startbeleg an BMF senden', 'Senden');
            op_popup.$('.execute_button').click(function() {
                self.bmf_register_start_receipt_rpc().then(
                    function done() {
                        op_popup.success("Startbeleg wurde erfolgreich eingereicht!");
                        op_popup.$('.close_button').show();
                    },
                    function failed(message) {
                        op_popup.failure(message);
                        op_popup.$('.close_button').show();
                    }
                );
                op_popup.success("Startbeleg wurde übermittelt und wird gerade überprüft!!!");
                op_popup.$('.execute_button').hide();
                op_popup.$('.close_button').hide();
            });
        },
        // starts catching keyboard events and tries to interpret codebar
        // calling the callbacks when needed.
        connect: function () {
            console.log('RKSV connect got called !');
        },
        // stops catching keyboard events
        disconnect: function () {
            console.log('RKSV disconnect got called !');
        },
        // the barcode scanner will listen on the hw_proxy/scanner interface for
        // scan events until disconnect_from_proxy is called
        connect_to_proxy: function () {
            console.log('RKSV connect to proxy got called !');
        },
        // the barcode scanner will stop listening on the hw_proxy/scanner remote interface
        disconnect_from_proxy: function () {
            console.log('RKSV disconnect from proxy got called !');
        }
    });

    return {
        RKSV: RKSV,
    };
});