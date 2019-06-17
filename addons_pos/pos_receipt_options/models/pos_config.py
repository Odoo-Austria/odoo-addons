# -*- coding: utf-8 -*-

from odoo import fields, models


class PosConfig(models.Model):
    _inherit = 'pos.config'

    print_shop_name = fields.Boolean(string='Name', default=True)
    print_shop_logo = fields.Boolean(string='Logo', default=True)
    print_shop_address = fields.Boolean(string='Address', default=True)
    print_shop_phone = fields.Boolean(string='Phone', default=True)
    print_shop_vat = fields.Boolean(string='VAT', default=True)
    print_shop_email = fields.Boolean(string='EMail', default=True)
    print_shop_website = fields.Boolean(string='Website', default=True)
    print_shop_cashier = fields.Boolean(string='Cashier', default=True)
    print_shop_customer = fields.Boolean(string='Customer', default=True)
    print_shop_customer_address = fields.Boolean(string='Customer Address', default=True)
