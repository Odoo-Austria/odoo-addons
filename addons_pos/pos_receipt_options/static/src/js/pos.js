openerp.pos_receipt_options = function(instance){
    var module = instance.point_of_sale;

    module.load_fields("res.company", ["street", "street2", "zip", "city"]);
    /*
    No Rocket Sience here - just add the pos config record to the receipt
     */
    var OrderModelSuper = module.Order.prototype;
    module.Order = module.Order.extend({
        export_for_printing: function () {
            var company = this.pos.company;
            var data = OrderModelSuper.export_for_printing.call(this);
            data.config = this.pos.config;
            data.company.contact_address = company.street + " in " + company.zip + "-" + company.city;
            data.company.street = company.street;
            data.company.street2 = company.street2;
            data.company.zip = company.zip;
            data.company.city = company.city;
            return data;
        },
    });
};