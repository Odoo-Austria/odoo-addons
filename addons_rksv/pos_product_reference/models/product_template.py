# -*- coding: utf-8 -*-

from openerp import fields, api, models


class ProductTemplate(models.Model):
    _inherit = 'product.template'

    product_ref = fields.Boolean('Product Reference')