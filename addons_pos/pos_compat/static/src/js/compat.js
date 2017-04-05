openerp.pos_compat = function(instance){
    var module = instance.point_of_sale;

    // A helper to get a reference to an existing model
    module.get_model = function(modelname) {
        var model = _.find(module.PosModel.prototype.models, function(model) {
            return model['model'] == modelname;
        });
        return model;
    };
    // Append fields to an existing model
    module.load_fields = function(modelname, fields) {
        var model = module.get_model(modelname);
        if (!model) {
            console.log('Error - tried to add fields to non existing model '+modelname);
        } else {
            model['fields'] = model['fields'].concat(fields);
        }
    };
    // Add more models
    module.load_models = function(newmodels) {
        if (!(newmodels instanceof Array)) {
            newmodels = new Array(newmodels);
        }
        _.each(newmodels, function(newmodel) {
            var existing_model = module.get_model(newmodel['model']);
            // Push it only if it does not exist already
            if (existing_model) {
                console.log('Error - tried to add already existing model to list of models');
            } else {
                module.PosModel.prototype.models.push(newmodel);
            }
        });
    };

    /*
    pos.gui Compat Implementation
     */
    var PosWidgetSuper = module.PosWidget;
    module.PosWidget = module.PosWidget.extend({
        extrascreens: new Array(),
        extrapopups: new Array(),
        extrawidgets: new Array(),
        popup_instances: {},
        init: function() {
            PosWidgetSuper.prototype.init.call(this);
            // Create pos.gui object for compatibility reasons
            // with gui.chrome.widget.order_selector
            this.chrome = {
                'widget': {
                    'order_selector': this
                }
            };
            this.pos.gui = this;
        },
        show_screen: function(screenname, options) {
            this.pos.pos_widget.screen_selector.set_current_screen(screenname, options);
        },
        show_popup: function(popupname, options) {
            this.pos.pos_widget.screen_selector.show_popup(popupname, options);
        },
        back: function() {
            this.pos.pos_widget.screen_selector.back();
        },
        define_screen: function(screen) {
            module.PosWidget.prototype.extrascreens.push(screen);
        },
        define_popup: function(popup) {
            module.PosWidget.prototype.extrapopups.push(popup);
        },
        build_widgets: function() {
            // Supercall
            PosWidgetSuper.prototype.build_widgets.call(this);
            // Then add the defined extra screens
            _.each(module.PosWidget.prototype.extrascreens, function(screen) {
                this[screen['name']] = new screen['widget'](this, {});
                if (screen['position']) {
                    this[screen['name']].appendTo($(screen['position']));
                } else {
                    this[screen['name']].appendTo(this.$('.screens'));
                }
                this.screen_selector.add_screen(screen['name'], this[screen['name']])
            }, this);
            // And do add the extra popups
            _.each(module.PosWidget.prototype.extrapopups, function(popup) {
                this.popup_instances[popup['name']] = new popup['widget'](this, {});
                this.popup_instances[popup['name']].appendTo(this.$el);
                // Do add the popup to the popup set
                this.screen_selector.popup_set[popup['name']] = this.popup_instances[popup['name']];
                this.popup_instances[popup['name']].hide();
            }, this);
            this.default_screen = this.screen_selector.default_screen;
            // Do add the extra widgets here
            _.each(module.PosWidget.prototype.extrawidgets, function(widget) {
                this[widget['name']] = new widget['widget'](this, {});
                this[widget['name']].appendTo(this.$(widget['append']));
            }, this);
        }
    });

    /*
    Extend module.Order
    - map add_product to addProduct
    - provide get_paymentlines function
     */
    module.Order = module.Order.extend({
        add_product: function(product, options) {
            return this.addProduct(product, options);
        },
        get_paymentlines: function() {
            return this.get('paymentLines');
        }
    });

    /*
    Extend module.Orderline
    - map get_taxes to get_applicable_taxes
     */
    module.Orderline = module.Orderline.extend({
        get_taxes: function() {
            return this.get_applicable_taxes();
        }
    });
}