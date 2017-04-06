/*
 Do allow the cashier to select an open invoice that the customer will pay
 */

function openerp_payinvoice_models(instance, module) {
    "use strict";
    var models = module;
    var core = instance.web;
    var _t = core._t;

    /*
    Define Invoice Model
     - in global models namespace
     */
    models.Invoice = Backbone.Model.extend({
        idAttribute: "id",
        initialize: function(attr,options) {
            this.pos = options.pos;
        },
        get_partner: function() {
            return this.pos.db.get_partner_by_id(this.get('partner_id')[0]);
        },
        get_partner_displayname: function() {
            var partner = this.get_partner();
            if (partner) {
                return partner.name;
            } else {
                return _t("Unknown");
            }
        }
    });

    /*
    Define Invoices Collection - does hold all loaded invoices
     - in global models namespace
     */
    models.Invoices = Backbone.Collection.extend({
        model: models.Invoice,
    });

    // Load Odoo configured signature providers - check if this is still needed !
    models.load_models({
        model: 'account.invoice',
        fields: ['name', 'number', 'partner_id', 'date_invoice', 'amount_total', 'date_due', 'id'],
        domain: function (self) {
            return [['state', '=', 'open']];   // Do load open invoices
        },
        loaded: function (self, invoices) {
            if ((invoices) && (invoices.length > 0)) {
                _.each(invoices, function(invoicedata) {
                    var invoice = new models.Invoice(invoicedata, {
                        pos: this,
                    });
                    this.invoices.push(invoice);
                }, self);
            }
        }
    });

    var OrderlineModelSuper = models.Orderline.prototype;
    models.Orderline = models.Orderline.extend({
        initialize: function(attr,options){
            this.invoice_id = null;
            OrderlineModelSuper.initialize.call(this, attr, options);
        },
        get_invoice: function() {
            if (!this.invoice_id)
                return null;
            return this.pos.invoices.findWhere({
                'id': this.invoice_id
            });
        },
        export_for_printing: function () {
            var data = OrderlineModelSuper.export_for_printing.call(this);
            if (this.get_invoice()){
                data.invoice = this.get_invoice().attributes;
            }
            return data;
        },
        clone: function() {
            if (this.invoice_id) {
                return null;
            }
            return OrderlineModelSuper.clone.call(this);
        },
        set_discount: function(discount) {
            if (this.invoice_id) {
                return null;
            }
            return OrderlineModelSuper.set_discount.call(this, discount);
        },
        set_unit_price: function(price){
            var invoice = this.get_invoice();
            if ((invoice) && (price > invoice.get('amount_total'))) {
                this.pos.pos_widget.screen_selector.show_popup('error',{
                    'message': _t("Error"),
                    'comment': _t("You can not enter a higher price than the total amount of the invoice !")
                });
                return;
            }
            return OrderlineModelSuper.set_unit_price.call(this, price);
        },
        set_quantity: function(quantity) {
            if ((this.invoice_id) && (quantity > 1)) {
                this.pos.pos_widget.screen_selector.show_popup('error',{
                    'message': _t("Error"),
                    'comment': _t("You can not pay the invoice more than 1 time !")
                });
                return;
            }
            return OrderlineModelSuper.set_quantity.call(this, quantity);
        },
        can_be_merged_with: function(orderline){
            if (this.invoice_id) {
                return false;
            }
            return OrderlineModelSuper.can_be_merged_with.call(this, orderline);
        },
        export_as_JSON: function() {
            var data = OrderlineModelSuper.export_as_JSON.call(this);
            data['invoice_id'] = this.invoice_id;
            return data;
        },
        init_from_JSON: function(json) {
            OrderlineModelSuper.init_from_JSON.call(this, json);
            this.invoice_id = json['invoice_id'];
            if (!this.get_invoice()) {
                this.quantity = 0;
            }
        },
    });

    var OrderModelSuper = models.Order.prototype;
    models.Order = models.Order.extend({
        addProduct: function(product, options) {
            var last_orderline = this.getLastOrderline();
            if ((last_orderline) && (last_orderline.invoice_id)) {
                // Nothing else is allowed - so create new order here
                this.pos.add_new_order();
                var order = this.pos.get_order();
                order.addProduct(product, options);
                // Get Orderline
                if (options && options.extras && options.extras.invoice) {
                    var orderline = order.getLastOrderline();
                    orderline.invoice_id = options.extras.invoice.get('id');
                    // We need to force a rerender here
                    order.get('orderLines').trigger('change', last_orderline);
                }
                return;
            }
            // Everything is ok - proceed
            OrderModelSuper.addProduct.call(this, product, options);
            // Get ORderline
            if (options && options.extras && options.extras.invoice) {
                var last_orderline = this.getLastOrderline();
                last_orderline.invoice_id = options.extras.invoice.get('id');
                // We need to force a rerender here
                this.get('orderLines').trigger('change', last_orderline);
            }
        },
    });

}