odoo.define('pos_rksv.db', function (require) {
    "use strict";

    var PosDB = require("point_of_sale.DB");

    PosDB.include({
        invisible_filtered: function(products) {
            if (products instanceof Array) {
                return _.filter(products, function (product) {
                    return !product['pos_product_invisible'];
                }, this);
            } else {
                if (products === undefined || products['pos_product_invisible'] === true) {
                    return undefined;
                } else {
                    return products;
                }
            }
        },
        // Filter out products which should be invisible
        get_product_by_category: function (category_id) {
            var products = this._super(category_id);
            return this.invisible_filtered(products);
        },
        search_product_in_category: function (category_id, query){
            var products = this._super(category_id, query);
            return this.invisible_filtered(products);
        },
        get_product_by_barcode: function(barcode){
            var products = this._super(barcode);
            return this.invisible_filtered(products);
        }
    });
});