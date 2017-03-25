/*
 Do extend the main pos Model here !
 */
openerp.pos_pay_invoice = function(instance){
    var module = instance.point_of_sale;
    var models   = module;
    var QWeb = instance.web.qweb;

    // We do require the invoice model and collection
    openerp_payinvoice_models(instance, module);
    // Also include our screens
    openerp_payinvoice_screens(instance, module);

    /*
     PosModel ist the main pos Model - which does get referenced everywhere with pos
     */
    var PosModelSuper = models.PosModel;
    models.PosModel = models.PosModel.extend({
        initialize: function (session, attributes) {
            // Init empty invoices collection
            this.invoices = new models.Invoices(null, {
                pos: this
            });
            // Supercall
            PosModelSuper.prototype.initialize.call(this, session, attributes);
        },
    });

    module.PosWidget.include({
        build_widgets: function(){
            var self = this;
            this._super();

            if(this.pos.config.search_invoices){
                this.invoicelist_screen = new module.InvoiceListScreenWidget(this,{});
                this.invoicelist_screen.appendTo(this.$('.screens'));
                this.screen_selector.add_screen('invoicelist',this.invoicelist_screen);

                var searchinvoices = $(QWeb.render('SearchInvoicesButton'));

                searchinvoices.click(function(){
                    self.pos_widget.screen_selector.set_current_screen('invoicelist');
                });

                searchinvoices.appendTo(this.$('.control-buttons'));
                this.$('.control-buttons').removeClass('oe_hidden');
            }
        },
    });

};