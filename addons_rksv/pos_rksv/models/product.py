# -*- coding: utf-8 -*-

from openerp import models, fields, api, _
import logging

_logger = logging.getLogger(__name__)


class ProductTemplate(models.Model):
    _inherit = 'product.template'

    @api.multi
    @api.depends('taxes_id', 'taxes_id.rksv_tax', 'taxes_id.rksv_tax_category')
    def _compute_rksv_tax_mapping_correct(self):
        for template in self:
            rksv_tax = False
            for tax in template.taxes_id:
                if tax.rksv_tax and tax.rksv_tax_category > "":
                    rksv_tax = True
                    break
            template.rksv_tax_mapping_correct = rksv_tax

    rksv_product_type = fields.Selection(
        selection=[
            ('product', 'Produkt / Leistungsgutschein'),
            ('coupon', 'Wertgutschein'),
            ('startreceipt', 'Startbeleg'),
            ('yearreceipt', 'Jahresbeleg'),
            ('monthreceipt', 'Monatsbeleg'),
            ('nullreceipt', 'Nullbeleg'),
        ],
        string='RKSV Produkt Art', required=True, default='product')
    rksv_tax_mapping_correct = fields.Boolean(
        string='RKSV Steuern',
        store=True,
        compute=_compute_rksv_tax_mapping_correct,
        readonly=True)
    pos_product_invisible = fields.Boolean('Nicht sichtbar am POS', default=False)
