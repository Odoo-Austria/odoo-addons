/*
 Do extend the main pos Model here !
 */
odoo.define('pos_pay_invoice.pos', function (require) {
    "use strict";

    var models = require('point_of_sale.models');
    // We do require the signature model and collection
    require('pos_pay_invoice.models');
    var Model = require('web.DataModel');

    /*
     PosModel ist the main pos Model - which does get referenced everywhere with pos
     */
    var PosModelSuper = models.PosModel;
    models.PosModel = models.PosModel.extend({
        initialize: function (session, attributes) {
            // Init empty invoices collection
            this.invoices = new models.Invoices(null, {
                pos: this
            });
            // Supercall
            PosModelSuper.prototype.initialize.call(this, session, attributes);
        },
    });
});