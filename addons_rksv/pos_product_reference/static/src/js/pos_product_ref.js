odoo.define('pos_product_reference.pos_product_reference', function (require) {
    "use strict";

    var models = require('point_of_sale.models');
    var core = require('web.core');
    var screens = require('point_of_sale.screens');

    /*
    Here we do add the fields and the models we need to load from the server
     */
    // BMF Fields we do need to communicate directly with the BMF SOAP Service
    models.load_fields("product.product", [ "product_ref" ]);

    var OrderlineSuper = models.Orderline;
    models.Orderline = models.Orderline.extend({
        initialize: function(attr,options){
            OrderlineSuper.prototype.initialize.call(this, attr, options);
            this.product_ref_text;
        },
        clone: function(){
            var data = OrderlineSuper.prototype.clone.call(this);
            data.product_ref_text = this.product_ref_text;
            return data;
        },
        set_product_reference: function(ref){
            this.product_ref_text = ref;
        },
        get_product_reference: function(){
            return this.product_ref_text;
        },
        export_as_JSON: function(){
            var data = OrderlineSuper.prototype.export_as_JSON.call(this);
            data.product_ref_text = this.get_product_reference();
            return data;
        },
       export_for_printing : function() {
            var data = OrderlineSuper.prototype.export_for_printing.call(this);
            data.product_ref_text = this.get_product_reference();
            return data;
        }
    });

    screens.OrderWidget.include({
        template:'OrderWidget',
        init: function(parent, options) {
            var self = this;
            this._super(parent,options);
            this.line_keyup_handler = function(event){
                var ref_text = this.value;
                var order = self.pos.get('selectedOrder');
                order.get_selected_orderline().set_product_reference(ref_text);
            };
            this.bind_order_events();
        },
        render_orderline: function(orderline){
            var el_node = this._super(orderline);
            var input_ref = $(el_node).find('li input');
            if (input_ref.length > 0)
                $(el_node).find('input')[0].addEventListener('keyup',this.line_keyup_handler);

            orderline.node = el_node;
            return el_node;
        }
    });
});