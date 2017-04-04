function openerp_rksv_popups(instance, module){
    // This file contains the Popups.
    // Popups must be loaded and named in chrome.js.
    // They are instanciated / destroyed with the .gui.show_popup()
    // and .gui.close_popup() methods.

    var PopupWidget = module.PopUpWidget;
    var gui = module.PosWidget.prototype;

    /*
    RKSV Generic Popup Widget
    - does provide POS Admin Password Handling
    - does provide a customer info input box
    - configureable buttons
     */

    var RKSVPopUpWidget = PopupWidget.extend({
        template:'RKSVOperationPopupWidget',
        // Display kundeninfo textarea or not
        kundeninfo: false,
        // Do install default event handlers
        installEventHandler: function() {
            var self = this;
            // Install close button event handler
            this.$('.close_button').off();
            this.$('.close_button').on('click', function(){
                self.hide();
            });
            // Install event handler for authorize button
            this.$('.authorize_button').off();
            this.$('.authorize_button').on('click', function(){
                self.check_passwd();
            });
        },
        show: function(show_options, title, exec_button_title, kundeninfo){
            this.kundeninfo = kundeninfo;
            this._super(show_options);
            // Do set default values
            this.$('.title').html(title);
            this.$('.execute_button').html(exec_button_title?exec_button_title:'Ausführen');
            this.$('.kundeninfo').val('');
            this.$('.execute_button').hide();
            this.$('.close_button').show();
            this.installEventHandler();
        },
        hide: function(){
            if(this.$el){
                this.$el.addClass('oe_hidden');
            }
            this.$('.content').removeClass('oe_hidden');
            this.$('.loading').addClass('oe_hidden');
            this.$('.message').html("");
            this.$('.passwd_input').show();
            this.$('.authorize_button').show();
            this.$('.execute_button').hide();
            this.$('.pos_admin_passwd').val('');
        },
        loading: function(message) {
            this.$('.content').addClass('oe_hidden');
            this.$('.loading').removeClass('oe_hidden');
            this.$('.loading').html(message);
        },
        loading_done: function() {
            this.$('.content').removeClass('oe_hidden');
            this.$('.loading').addClass('oe_hidden');
            this.$('.kundeninfo_div').hide();
        },
        success: function(message) {
            this.loading_done();
            this.$('.message').html(message);
        },
        failure: function(message) {
            this.loading_done();
            this.$('.message').html('<p style="color: red;">' + message + '</p>');
        },
        check_passwd: function() {
            var pos_admin_passwd = this.pos.config.pos_admin_passwd;
            var entered_passwd = this.$('.pos_admin_passwd').val();
            if (pos_admin_passwd === entered_passwd) {
                this.$('.message').html("Authorized");
                this.$('.passwd_input').hide();
                this.$('.authorize_button').hide();
                this.$('.execute_button').show();
                if (this.kundeninfo)
                    this.$('.kundeninfo_div').show();
                return true;
            } else {
                this.$('.pos_admin_passwd').removeAttr('value');
                this.$('.message').html("Password incorrect.");
                this.$('.kundeninfo_div').hide();
                return false;
            }
        }
    });
    gui.define_popup({name:'rksv_popup_widget', widget: RKSVPopUpWidget});

    /*
    Based on default Popup Widget - only an other Template
     */
    var RegisterCashboxPopupWidget = RKSVPopUpWidget.extend({
        template: 'RegisterCashboxPopupWidget',

        show: function(show_options, title, exec_button_title, kundeninfo){
            this._super(show_options, title, exec_button_title, kundeninfo);
            // Hide the additional data fields per default
            this.$('.startreceipt_div').hide();
        },
        check_passwd: function() {
            var valid = this._super();
            if (valid) {
                // Show the additional data fields on valid password
                this.$('.startreceipt_div').show();
            }
        },
        loading: function(message) {
            this._super(message);
            this.$('.startreceipt_div').hide();
        }
    });
    gui.define_popup({name:'rksv_register_cashbox_widget', widget: RegisterCashboxPopupWidget});


    /*
    Based on default Popup Widget - only an other Template
     */
    var RKSVSProviderAusfallPopupWidget = RKSVPopUpWidget.extend({
        template:'RKSVSProviderAusfallPopupWidget',
        // Extend show function to also hide the begruendung division on show
        show: function(show_options, title, exec_button_title, kundeninfo) {
            this._super(show_options, title, exec_button_title, kundeninfo);
            this.$('.begruendung_div').hide();
        },
        // Extend password check - on correct password do display begruendung_div
        check_passwd: function() {
            var password_ok = this._super();
            if (password_ok) {
                this.$('.begruendung_div').show();
            } else {
                this.$('.begruendung_div').hide();
            }
            return password_ok;
        },
        // Do extend loading done to also hide the begruendung_div
        loading_done: function() {
            this._super();
            this.$('.begruendung_div').hide();
        }
    });
    gui.define_popup({name:'rksv_sprovider_ausfall_popup', widget: RKSVSProviderAusfallPopupWidget});

    var RKSVSProviderWiederinbetriebnahmePopupWidget = RKSVPopUpWidget.extend({
        template:'RKSVSProviderWiederinbetriebnahmePopupWidget'
    });
    gui.define_popup({name:'rksv_provider_wiederinbetriebnahme_widget', widget: RKSVSProviderWiederinbetriebnahmePopupWidget});

    /*
     Will show data for FA Online
     */

    var RKSVFAPopupWidget = PopupWidget.extend({
        template:'RKSVFAPopupWidget',
        init: function(pos, options) {
            console.log('in RKSV FA Popup init');
            this._super(pos, options);
        },
        installEventHandler: function() {
            var self = this;
            // Install close button event handler
            this.$('.close_button').off();
            this.$('.close_button').on('click', function(){
                self.hide();
            });
        },
        show: function(show_options){
            var self = this;
            this._super(show_options);
            var signature = this.pos.get('signature');
            // Not sure if we need a signature for the starting record, but I guess we do
            if (signature === null){
                this.failure("No Signature provided yet.");
                return false
            }
            this.$('.rksvfa_serial').val(signature.get('serial'));
            this.$('.rksvfa_cashregisterid').val(this.pos.config.cashregisterid);
            this.$('.rksvfa_atu').val(this.pos.company.vat);
            this.loading("Bitte warten...");
            this.pos.proxy.connection.rpc(
                    '/hw_proxy/rksv_get_fa_data',
                    Object.assign(self.pos.rksv.get_rksv_info()),
                    {timeout: 7500}
                ).then(
                function done(response) {
                    self.$('.rksvfa_aes_key').val(response.aes_key);
                    if (response.start_receipt && response.start_receipt.qrcodeImage){
                        self.$('.rksvfa_image').attr('src', response.start_receipt.qrcodeImage);
                    } else {
                        self.$('#rksvfa_startbeleg').html('Kein Startbeleg vorhanden!');
                        self.$('.rksvfa_image').hide();
                    }
                    self.loading_done();
                },
                function failed() {
                    self.loading_done();
                }
            );
            this.installEventHandler();
        },
        hide: function(){
            if(this.$el){
                this.$el.addClass('oe_hidden');
            }
        },
        loading: function(message) {
            this.$('.content').addClass('oe_hidden');
            this.$('.loading').removeClass('oe_hidden');
            this.$('.loading').html(message);
        },
        loading_done: function() {
            this.$('.content').removeClass('oe_hidden');
            this.$('.loading').addClass('oe_hidden');
        },
        failure: function(message) {
            this.$('.data').addClass('oe_hidden');
            this.$('.loading').addClass('oe_hidden');
            this.$('.message').html('<p style="color: red;">' + message + '</p>');
        },
    });
    gui.define_popup({name:'rksv_fa_widget', widget: RKSVFAPopupWidget});
}