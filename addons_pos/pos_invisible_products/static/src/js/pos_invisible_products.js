openerp.pos_invisible_products = function(instance, module) {

    var module = instance.point_of_sale;
    module.load_fields("product.product", ['pos_product_invisible']);

    module.PosDB.include({
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
}