# -*- coding: utf-8 -*-

from odoo import fields, models


class PosConfig(models.Model):
    _inherit = 'pos.config'

    # Redeclare invoice_product_id here and add some extra fields to the domain
    invoice_product_id = fields.Many2one(
        comodel_name='product.product',
        string='Invoice (Product)',
        domain=[
            ('sale_ok', '=', True),
            ('available_in_pos', '=', True),
            ('rksv_tax_mapping_correct', '=', True),
            ('rksv_product_type', '=', 'nullreceipt')
        ],
        required=True
    )

