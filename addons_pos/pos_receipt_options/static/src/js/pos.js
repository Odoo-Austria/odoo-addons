openerp.pos_receipt_options = function(instance){
    var module = instance.point_of_sale;

    /*
    No Rocket Sience here - just add the pos config record to the receipt
     */
    var OrderModelSuper = module.Order.prototype;
    module.Order = module.Order.extend({
        export_for_printing: function () {
            var data = OrderModelSuper.export_for_printing.call(this);
            data.config = this.pos.config;
            return data;
        },
    });
};