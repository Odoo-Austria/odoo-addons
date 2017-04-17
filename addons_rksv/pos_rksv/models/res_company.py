# -*- coding: utf-8 -*-

from odoo import models, fields, api, _
import logging

_logger = logging.getLogger(__name__)


class Company(models.Model):
    _name = 'res.company'
    _inherit = 'res.company'

    rksv_at = fields.Boolean('RKSV AT', default=True)
    bmf_tid = fields.Char('BMF TID', size=32, copy=False)

    bmf_benid = fields.Char('BMF Benutzer ID', size=32, copy=False)
    bmf_pin = fields.Char('BMF PIN', size=32, copy=False)
    bmf_hersteller_atu = fields.Char('BMF RK Hersteller ATU', size=32, copy=False)

    bmf_tax_number = fields.Char('RKSV Tax Identifier', size=10)
    bmf_vat_number = fields.Char('RKSV VAT Identifier', readonly=True, related='vat')
