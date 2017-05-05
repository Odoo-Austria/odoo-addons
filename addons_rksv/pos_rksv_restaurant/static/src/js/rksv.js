odoo.define('pos_rksv_restaurant.rksv', function (require) {
    "use strict";

    // We do require the rksv module - we do extend it
    var rksv = require('pos_rksv.rksv');

    /* RKSV Core Extension */

    rksv.RKSV = rksv.RKSV.extend({
        create_dummy_order: function(product_id, reference) {
            // Set the default table here before we add the order - save the current for restore later
            var currentTable = this.pos.table;
            var table = this.pos.tables_by_id[this.pos.config.default_table_id[0]];
            this.pos.set_table(table);
            // Make super call to create dummy order
            var order = this._super(product_id, reference);
            return order;
        },
    });
});