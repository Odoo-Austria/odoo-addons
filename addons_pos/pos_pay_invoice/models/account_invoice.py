# -*- coding: utf-8 -*-

from odoo import fields, models
import logging

_logger = logging.getLogger(__name__)


class AccountInvoice(models.Model):
    _inherit = 'account.invoice'

    pos_order_id = fields.Many2one(
        comodel_name='pos.order',
        string="Related PoS Order",
        compute='_retrieve_pos_data',
        readonly=True,
    )

    def _retrieve_pos_data(self):
        for invoice in self:
            pos_order = self.env['pos.order'].search([('invoice_id', '=', invoice.id)])
            invoice.pos_order_id = pos_order or False
