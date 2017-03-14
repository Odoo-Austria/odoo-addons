odoo.define('pos_rksv.devices', function (require) {
    "use strict";

    var devices = require('point_of_sale.devices');
    var core = require('web.core');

    //var QWeb = core.qweb;
    var _t = core._t;

    devices.ProxyDevice.include({
        // sorry - we have to complete overwrite this function
        keepalive: function () {
            var self = this;

            function status() {
                self.connection.rpc('/hw_proxy/status_json_rksv', {
                    'rksv': {
                        'kassenidentifikationsnummer': self.pos.config.cashregisterid
                    }
                }, {timeout: 2500})
                    .then(function (driver_status) {
                        self.set_connection_status('connected', driver_status);
                    }, function () {
                        if (self.get('status').status !== 'connecting') {
                            self.set_connection_status('disconnected');
                        }
                    }).always(function () {
                    setTimeout(status, 5000);
                });
            }

            if (!this.keptalive) {
                this.keptalive = true;
                status();
            }
        },
    });
});