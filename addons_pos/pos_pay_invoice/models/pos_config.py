# -*- coding: utf-8 -*-

from openerp import fields, models


class PosConfig(models.Model):
    _inherit = 'pos.config'

    search_invoices = fields.Boolean(string='Search for open Invoices', help='Pay open invoices on POS')
    invoice_product_id = fields.Many2one(
        comodel_name='product.product',
        string='Invoice (Product)',
        domain=[('sale_ok', '=', True), ('available_in_pos', '=', True)],
        required=True
    )

