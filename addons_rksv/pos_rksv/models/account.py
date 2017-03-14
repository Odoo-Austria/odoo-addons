# -*- coding: utf-8 -*-

from odoo import models, fields, api, _

import logging

_logger = logging.getLogger(__name__)


class AccountTax(models.Model):
    _inherit = 'account.tax'

    rksv_tax = fields.Boolean(
        string="Valid for RKSV"
    )
    rksv_tax_category = fields.Selection(
        selection=[
            ('taxSetNormal', 'Normalsteuersatz 20%'),
            ('taxSetErmaessigt1', 'ermäßigter Steuersatz 10%'),
            ('taxSetErmaessigt2', 'ermäßigter Steuersatz 13%'),
            ('taxSetBesonders', 'besonderer Steuersatz 19%'),
            ('taxSetNull', 'Nullsteuersatz 0%'),
        ],
        string="RKSV Tax Category"
    )
