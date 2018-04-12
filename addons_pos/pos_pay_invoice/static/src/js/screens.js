odoo.define('pos_pay_invoice.screens', function (require) {
    "use strict";

    var screens = require('point_of_sale.screens');
    var gui = require('point_of_sale.gui');
    var DomCache = screens.DomCache;
    var core = require('web.core');
    var QWeb = core.qweb;
    var _t = core._t;
    var rpc = require('web.rpc');
    var models = require('point_of_sale.models');

    var SearchInvoicesButton = screens.ActionButtonWidget.extend({
        template: 'SearchInvoicesButton',
        button_click: function () {
            var order = this.pos.get_order();
            if (order) {
                this.pos.gui.show_screen('invoicelist', {
                    confirm: function (invoice) {
                        // Add line here

                    },
                });
            }
        },
    });

    screens.define_action_button({
        'name': 'search_invoice_button',
        'widget': SearchInvoicesButton,
        'condition': function () {
            return this.pos.config.search_invoices;
        },
    });

    /*--------------------------------------*\
     |         THE INVOICE LIST             |
    \*======================================*/

    // The invoice list does display open invoices
    // and allows the cashier to search for an invoice

    var InvoiceListScreenWidget = screens.ScreenWidget.extend({
        template: 'InvoiceListScreenWidget',

        init: function(parent, options){
            this._super(parent, options);
            this.invoice_cache = new DomCache();
        },

        auto_back: true,

        show: function(){
            var self = this;
            this._super();

            this.renderElement();
            // Does this not gets fired more than once if called severall times ?
            this.$('.back').click(function(){
                console.log("Back button pressed");
                self.gui.back();
            });

            this.$('.next').click(function(){
                self.save_changes();
                self.gui.back();
            });

            this.$('.reload').click(function(){
                self.reload();
            });

            this.render_list(this.pos.invoices.sortBy('name'));

            this.$('.invoice-list-contents').delegate('.invoice-line','click',function(event){
                self.line_select(event,$(this),parseInt($(this).data('id')));
            });

            var search_timeout = null;

            if(this.pos.config.iface_vkeyboard && this.chrome.widget.keyboard){
                this.chrome.widget.keyboard.connect(this.$('.searchbox input'));
            }

            this.$('.searchbox input').on('input',function(event){
                clearTimeout(search_timeout);

                var query = this.value;

                search_timeout = setTimeout(function(){
                    self.perform_search(query,event.which === 13);
                },70);
            });

            this.$('.searchbox .search-clear').click(function(){
                self.clear_search();
            });
            // Do reload invoice list to be up to date
            self.reload();
        },
        hide: function () {
            this._super();
        },
        perform_search: function(query, associate_result){
            var customers;
            if(query){
                this.render_list(this.pos.invoices.filter(function(invoice) {
                    // TODO compare here
                    return true;
                }));
            }else{
                this.render_list(this.pos.invoices.sortBy('name'));
            }
        },
        reload: function() {
            var self = this;
            self.reload_invoices().then(
                function() {
                    self.render_list(self.pos.invoices.sortBy('name'));
                },
                function() {
                    self.pos.gui.show_popup('error',{
                        'title': _t("Fehler"),
                        'body': _t("Konnte Rechnungen nicht neu laden")
                    });
                }
            );
        },
        reload_invoices: function() {
            var self = this;
            var def  = new $.Deferred();
            var fields = _.find(this.pos.models,function(model){ return model.model === 'account.invoice'; }).fields;
            rpc.query({
                'model': 'account.invoice',
                'method': 'search_read',
                'domain': ['&', ['state', '=', 'open'], ['pos_order_id', '=', false]],
                'fields': fields,
            }).then(
                function(invoices){
                // Add the new invoices
                var model_invoices = new Array;
                _.each(invoices, function(invoicedata) {
                    var invoice = new models.Invoice(invoicedata, {
                        pos: this.pos,
                    });
                    model_invoices.push(invoice);
                }, self);
                self.pos.invoices.reset(model_invoices);
                def.resolve();
            }, function(err,event){
                def.reject();
            });
            return def;
        },
        clear_search: function(){
            this.render_list(this.pos.invoices.sortBy('name'));
            this.$('.searchbox input')[0].value = '';
            this.$('.searchbox input').focus();
        },
        save_changes: function(){
            var order = this.pos.get_order();
            if ((!order) || (!order.is_empty())) {
                // No order - or order is not empty
                // Set previous screen on original order
                order.set_screen_data('screen', order.get_screen_data('previous-screen'));
                // And create a new order
                this.pos.add_new_order();
                // And get it
                order = this.pos.get_order();
            }
            var new_client = this.new_invoice.get_partner();
            // Set invoice partner as order client
            order.set_client(new_client);
            order.fiscal_position = _.find(this.pos.fiscal_positions, function (fp) {
                return fp.id === new_client.property_account_position_id[0];
            });

            var product = this.pos.db.get_product_by_id(this.pos.config.invoice_product_id[0]);
            // Add product to order
            order.add_product(product, {
                price: this.new_invoice.get('amount_total'),
                extras: {
                    invoice: this.new_invoice,
                },
                merge: false,
            });
        },
        render_list: function(invoices){
            var order = this.pos.get_order();
            var contents = this.$el[0].querySelector('.invoice-list-contents');
            contents.innerHTML = "";
            for(var i = 0, len = Math.min(invoices.length,1000); i < len; i++){
                var invoice    = invoices[i];
                // Check if this invoice is not already in this order
                var found = false;
                _.each(order.get_orderlines(), function(line) {
                    if ((line.invoice_id) && (line.invoice_id == invoice.get('id'))) {
                        found = true;
                    }
                }, this);
                if (found)
                    continue;

                var invoiceline = this.invoice_cache.get_node(invoice.id);
                if(!invoiceline){
                    var invoiceline_html = QWeb.render('InvoiceLine',{widget: this, invoice:invoice});
                    var invoiceline = document.createElement('tbody');
                    invoiceline.innerHTML = invoiceline_html;
                    invoiceline = invoiceline.childNodes[1];
                    this.invoice_cache.cache_node(invoice.id,invoiceline);
                }
                contents.appendChild(invoiceline);
            }
        },
        toggle_save_button: function(){
            var $button = this.$('.button.next');
            if( this.new_invoice ){
                $button.removeClass('oe_hidden');
                $button.text(_t('Add Invoice'));
            }else{
                $button.addClass('oe_hidden');
            }
        },
        line_select: function(event,$line,id){
            var invoice = this.pos.invoices.findWhere({
                'id': id
            });
            this.$('.invoice-list .lowlight').removeClass('lowlight');
            if ( $line.hasClass('highlight') ){
                $line.removeClass('highlight');
                $line.addClass('lowlight');
                this.new_invoice = null;
                this.toggle_save_button();
            }else{
                this.$('.invoice-list .highlight').removeClass('highlight');
                $line.addClass('highlight');
                this.new_invoice = invoice;
                this.toggle_save_button();
            }
        },
        close: function(){
            this._super();
        },
    });
    gui.define_screen({name:'invoicelist', widget: InvoiceListScreenWidget});

});