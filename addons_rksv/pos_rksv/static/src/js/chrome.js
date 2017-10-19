odoo.define('pos_rksv.chrome', function (require) {
    "use strict";

    var chrome = require('point_of_sale.chrome');
    var gui = require('point_of_sale.gui');
    var core = require('web.core');

    chrome.Chrome.include({
        replace_widget: function(name, widget_config) {
            for (var i=0; i < this.widgets.length; i++) {
                if (this.widgets[i]['name'] == name) {
                    this.widgets[i] = widget_config;
                }
            }

        }
    });
    var RKSVStatusWidget = chrome.StatusWidget.extend({
        template: 'RKSVStatusIndicatorWidget',
        // Possible status values
        status: ['connected','connecting','disconnected','warning','failure','setup','inactive'],
        set_smart_status: function (status) {
            var self = this;
            var mode = self.pos.get('cashbox_mode');
            if (mode == 'signature_failed') {
                this.set_status('failure', 'Ausfall SE');
            } else if (mode == 'posbox_failed') {
                this.set_status('failure', 'Ausfall PosBox');
            } else {
                if (status.status === 'connected' && (!(self.pos.config.state === "setup" || self.pos.config.state === "failure" || self.pos.config.state === "inactive"))) {
                    var rksvstatus = status.drivers.rksv ? status.drivers.rksv.status : false;
                    if (!rksvstatus) {
                        this.set_status('disconnected', '');
                    } else if (rksvstatus == 'connected') {
                        this.set_status('connected', '');
                    } else {
                        this.set_status(rksvstatus, '');
                    }
                } else if (status.status === 'connected' && (self.pos.config.state === "setup")) {
                    this.set_status('setup', 'Setup');
                } else if (status.status === 'connected' && (self.pos.config.state === "failure")) {
                    this.set_status('failure', 'Ausfall');
                } else if (status.status === 'connected' && (self.pos.config.state === "inactive")) {
                    this.set_status('inactive', 'Deaktiviert');
                } else {
                    this.set_status(status.status, '');
                }
            }
        },
        start: function () {
            var self = this;
            if (!self.pos.config.iface_rksv) {
                return this._super();
            }
            this.set_smart_status(this.pos.proxy.get('status'));
            this.pos.proxy.on('change:status', this, function (eh, status) {
                self.set_smart_status(status.newValue);
            });
            this.$el.click(function () {
                // Do Open the Main RKSV Status Popup
                self.pos.gui.show_screen('rksv_status', {
                    'stay_open': true
                });
            });
        },
        renderElement: function() {
            if (this.pos.config.iface_rksv) {
                return this._super();
            }
        }

    });

    /*
    We do regsiter the RKSV Status Widget
     */
    chrome.Chrome.prototype.widgets.unshift({
        'name':   'signature',
        'widget': RKSVStatusWidget,
        'append':  '.pos-rightheader'
    });

    /*
    Lets extend the Debug Widget - so we can add our own functions here
     */
    var DebugWidget = chrome.DebugWidget.extend({
        start: function () {
            // Supercall using prototype
            this._super();
            if (!this.pos.config.iface_rksv) {
                this.disable_rksv();
            } else {
                this.install_rksv_eventhandler();
            }
        },
        disable_rksv: function() {
            this.$('.rksvdebug').hide();
        },
        install_rksv_eventhandler: function() {
            var self = this;
            // Now do register our own events
            this.$('.button.rksv_firstreport').click(function(){
                self.pos.rksv.fa_first_report();
            });
            this.$('.button.rksv_status').click(function(){
                self.pos.gui.show_screen('rksv_status', {
                    'stay_open': true,
                });
            });
            this.$('.button.rksv_kasse_registrieren').click(function(){
                self.pos.rksv.bmf_kasse_registrieren();
            });
            this.$('.button.bmf_status_rk').click(function(){
                self.pos.rksv.bmf_status_rk();
            });
            this.$('.button.bmf_register_start_receipt').click(function(){
                self.pos.rksv.bmf_register_start_receipt();
            });
            this.$('.button.rksv_reset_dep').click(function(){
                self.pos.rksv.rksv_reset_dep();
            });
            this.$('.button.rksv_export_dep_crypt').click(function(){
                self.pos.rksv.rksv_write_dep_crypt_container();
            });
            this.$('.button.rksv_reprint_start_receipt').click(function(){
                self.pos.rksv.rksv_reprint_special_receipt('start', 'Startbeleg');
            });
            this.$('.button.rksv_reprint_month_receipt').click(function(){
                self.pos.rksv.rksv_reprint_special_receipt('month', 'Monatsbeleg');
            });
            this.$('.button.rksv_reprint_year_receipt').click(function(){
                self.pos.rksv.rksv_reprint_special_receipt('year', 'Jahresbeleg');
            });
            this.$('.button.rksv_create_null_receipt').click(function(){
                self.pos.rksv.rksv_create_null_receipt();
            });
        }
    });
    chrome.Chrome.prototype.replace_widget('debug', {
        'name':   'debug',
        'widget': DebugWidget,
        'append':  '.pos-content'
    });
});

