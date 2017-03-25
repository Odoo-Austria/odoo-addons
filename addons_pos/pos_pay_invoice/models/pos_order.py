# -*- coding: utf-8 -*-

from openerp import models, fields, api, _
import logging

_logger = logging.getLogger(__name__)


class PosOrderLine(models.Model):
    _inherit = "pos.order.line"

    invoice_id = fields.Many2one('account.invoice', string='Invoice', readonly=True)

class PosOrder(models.Model):
    _inherit = "pos.order"

