odoo.define('pos_receipt_options.pos', function (require) {
    "use strict";

    var models = require('point_of_sale.models');
    
    models.load_fields("res.company", ["street", "street2", "zip", "city"]);

    /*
    No Rocket Sience here - just add the pos config record to the receipt
     */
    var OrderModelSuper = models.Order.prototype;
    models.Order = models.Order.extend({
        export_for_printing: function () {
            var company = this.pos.company;
            var data = OrderModelSuper.export_for_printing.call(this);
            data.config = this.pos.config;
            data.company.contact_address = company.street + " in " + company.zip + "-" + company.city;
            data.company.street = company.street;
            data.company.street2 = company.street2;
            data.company.zip = company.zip;
            data.company.city = company.city;

            var client  = this.get('client');
            if (client) {
                data.customer = {
                    'name': client.name,
                    'street': client.street,
                    'city': client.city,
                    'zip': client.zip,
                };
            } else {
                data.customer = {};
            }
            data.customer.contact_address = company.street + " in " + company.zip + "-" + company.city;
            data.company.street = company.street;
            data.company.street2 = company.street2;
            data.company.zip = company.zip;
            data.company.city = company.city;

            return data;
        },
    });
});