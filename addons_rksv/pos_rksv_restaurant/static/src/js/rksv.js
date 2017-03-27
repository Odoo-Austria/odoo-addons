function openerp_rksv_restaurant(instance) {
    var module = instance.point_of_sale;
    /* RKSV Core Extension */

    module.RKSV = module.RKSV.extend({
        create_dummy_order: function(product_id, reference) {
            // Set the default table here before we add the order - save the current for restore later
            var currentTable = this.pos.table;
            var table = this.pos.tables_by_id[this.pos.config.default_table_id[0]];
            this.pos.set_table(table);
            // Make super call to create dummy order
            var order = this._super(product_id, reference);
            // Set back the old table
            this.pos.set_table(currentTable);
            return order;
        },
    });
}