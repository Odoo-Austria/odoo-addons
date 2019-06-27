# -*- coding: utf-8 -*-

from odoo import fields, api, models


class ProductTemplate(models.Model):
    _inherit = 'product.template'

    product_ref = fields.Boolean(string="Referenz im POS")
    product_ref_textarea = fields.Boolean(string="Referenz als Textarea")
