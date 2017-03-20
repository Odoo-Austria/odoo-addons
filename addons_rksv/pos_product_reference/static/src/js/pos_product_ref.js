openerp.pos_product_reference = function(instance) {
    var module = instance.point_of_sale;

    var OrderModelSuper = module.Order;

    var QWeb = instance.web.qweb;
    _t = instance.web._t;

    var PosModelParent = module.PosModel;
    module.PosModel = module.PosModel.extend({
        initialize: function (session, attributes) {
            var res = PosModelParent.prototype.initialize.apply(this, arguments);
            var self = this;
            // Extend fields of product.template
            product = this.pos_find_model('product.product');
            product.fields.push('product_ref');
        },
        pos_find_model: function (model_name) {
            var self = this;
            for (var i = 0, len = self.models.length; i < len; i++) {
                if (self.models[i].model === model_name) {
                    return self.models[i];
                }
            }
        },
    });

    var OrderlineSuper = module.Orderline;
    module.Orderline = module.Orderline.extend({
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

    module.OrderWidget = module.OrderWidget.extend({
        template:'OrderWidget',
        init: function(parent, options) {
            var self = this;
            this._super(parent,options);
            this.line_keyup_handler = function(event){
                var ref_text = this.value;
                var order = self.pos.get('selectedOrder');
                order.getSelectedLine().set_product_reference(ref_text);
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
}