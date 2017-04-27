openerp.pos_rksv = function (instance) {
    var module = instance.point_of_sale;
    var models = module;
    var Model = instance.web.Model;

    openerp_rksv_popups(instance, module);            // Import popup widgets
    openerp_rksv_models(instance, module);            // Import models
    openerp_rksv_rksv(instance, module);              // RKSV Object
    openerp_rksv_chrome(instance, module);            // Debug Widget, Status Indicator
    openerp_rksv_devices(instance, module);           // Overwrite the status json request
    openerp_rksv_screens(instance, module);           // Define the Status Screen, extend existing screens
    openerp_rksv_db(instance, module);                // PosDB Extensions

    /*
    PosModel ist the main pos Model - which does get referenced everywhere with pos
     */
    var PosModelSuper = models.PosModel;
    models.PosModel = models.PosModel.extend({
        initialize: function (session, attributes) {
            // Init empty signatures collection
            this.signatures = new models.Signatures(null, {
                pos: this
            });
            this.signature_update = false;
            // pos backbone attributes
            this.set({
                'bmf_status_rk': 'unknown',
                // This is for the current signature which is in use - it is of type module.Signature
                'signature': null,
                // This is the cashbox_mode flag
                // cashbox_mode = active - everything is ok
                // cashbox_mode = signature_failed - we can store the receipts - but cannot sign
                // cashbox_mode = posbox_failed - we lost PosBox - so not possible to store receipts !
                'cashbox_mode': 'active'
            });
            // Supercall
            PosModelSuper.prototype.initialize.call(this, session, attributes);
            var self = this;
            // Do initialize the main RKSV Handler Object !
            this.rksv = new module.RKSV({'pos': this, proxy: this.proxy});

            // The PosModel does handle the communication back to odoo
            this.signatures.on('add remove', function (signature, signatures) {
                console.log('do write back signature cards info to odoo');
                // Inform odoo about the current cards
                var provider_obj = new Model('signature.provider');
                var cardinfos = new Array();
                signatures.each(function (signature) {
                    cardinfos.push(signature.attributes);
                });
                signature.pos.signature_update = true;
                provider_obj.call('set_providers', [cardinfos, {'pos_config_id': self.config.id}]).always(
                    function finish(result) {
                        signature.pos.signature_update = false;
                    }
                );
            });
            this.bind('change:bmf_status_rk', function (pos, status) {
                // Save current state
                self.config.bmf_gemeldet = status.success;
                // Write back new status to odoo
                var configmodel = new Model('pos.config');
                configmodel.call('write', [[self.config.id], {
                    'bmf_gemeldet': status.success
                }]);
            });
            this.signatures.bind('change:bmf_status change:bmf_message', function (signature) {
                console.log('Try to fire an update for status in backend');
                var signaturemodel = new Model('signature.provider');
                if (!signature.pos.signature_update){
                    signature.pos.signature_update = true;
                    signaturemodel.call('update_status', [signature.attributes]).always(
                        function finish(result) {
	                        signature.pos.signature_update = false;
                        }
                    );
                }
            });
            // Bind on cashbox_mode flag
            this.bind('change:cashbox_mode', function (pos, state) {
                // Write back new status to odoo
                var configmodel = new Model('pos.config');
                configmodel.call('write', [[self.config.id], {
                    'state': state
                }]);
                // And store it locally
                self.config.state = state;
            });
            // Things to do when all models are loaded
            this.ready.done(function () {
                console.log('All data is loaded - so do my work...');
                // Check state from config - set it as my own state
                if (self.config.iface_rksv)
                    self.set('cashbox_mode', self.config.state);
            });
        },
        push_order: function (order, type) {
            var self = this;
            // Handle the dummy case - this can happen
            // Handle no rksv case
            if ((!order) || (!self.config.iface_rksv))
                return PosModelSuper.prototype.push_order.call(this, order);
            // This is my all - and really all deferred object
            var alldeferred = new $.Deferred(); // holds the global mutex
            var deferred = this.proxy.message('rksv_order', order.export_for_printing());
            deferred.then(
                function done(result) {
                    if (!result['success']) {
                        order.set_sign_failed();
                        alldeferred.reject(result['message']);
                    } else {
                        // Set result
                        order.set_sign_result(result);
                        // make super call which will create the order within odoo
                        PosModelSuper.prototype.push_order.call(self, order);
                        alldeferred.resolve();
                    }
                },
                function failed() {
                    order.set_sign_failed();
                    alldeferred.reject(_t("Es ist ein Fehler beim Erstellen der Signatur aufgetreten."));
                }
            );
            // Send back the alldeferred mutex
            return alldeferred;
        },
        push_and_invoice_order: function (order) {
            var self = this;
            // Handle the dummy case - this can happen
            // Handle no rksv case
            if ((!order) || (!self.config.iface_rksv))
                return PosModelSuper.prototype.push_order.call(this, order);
            if(!order.get_client()){
                return PosModelSuper.prototype.push_and_invoice_order.call(self, order);
            }
            // This is my all - and really all deferred object
            var alldeferred = new $.Deferred(); // holds the global mutex
            // This is my signature deferred object
            var deferred = this.proxy.message('rksv_order', order.export_for_printing());
            // Handle signature deferred
            deferred.then(
                function done(result) {
                    // Set order to finalized - so it can't get changed anymore !
                    order.set_sign_result(result);
                    order.finalized = true;
                    var invoiced = PosModelSuper.prototype.push_and_invoice_order.call(self, order);
                    invoiced.then(
                        function done() {
                            alldeferred.resolve();
                        },
                        function failed(error) {
                            // We do pass the error up to the next level
                            alldeferred.reject(error);
                        }
                    );
                },
                function failed() {
                    console.log('failed to sign receipt !!!');
                    order.set_sign_failed();
                    alldeferred.reject({
                        'message': 'Signatur fehlgeschlagen'
                    });
                }
            );
            // Do return the all deferred
            return alldeferred;
        }
    });

};
