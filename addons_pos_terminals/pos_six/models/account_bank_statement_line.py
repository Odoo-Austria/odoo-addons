# -*- coding: utf-8 -*-

from odoo import models, fields, api, _
import logging

_logger = logging.getLogger(__name__)


class ABStatementLine(models.Model):
    _inherit = 'account.bank.statement.line'

    six_ref_number = fields.Char('Six Ref Number')
    six_receipt = fields.Char('Six Beleg')
    six_receipt_html = fields.Char('Six Beleg')
    six_receipt_merchant = fields.Char('Six Händler Beleg')
    six_receipt_merchant_html = fields.Char('Six Händler Beleg')
