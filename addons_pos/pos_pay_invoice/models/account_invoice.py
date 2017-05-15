# -*- coding: utf-8 -*-

from odoo import fields, models, api
import logging

_logger = logging.getLogger(__name__)


class AccountInvoice(models.Model):
    _inherit = 'account.invoice'

    pos_order_ids = fields.One2many(
        comodel_name='pos.order',
        inverse_name='invoice_id',
        string="Related PoS Orders",
        readonly=True,
    )
    pos_order_id = fields.Many2one(
        comodel_name='pos.order',
        string="Related PoS Order",
        compute='_retrieve_pos_data',
        store=True,
        readonly=True,
    )


    @api.depends('pos_order_ids')
    def _retrieve_pos_data(self):
        for invoice in self:
            invoice.pos_order_id = invoice.pos_order_ids[0] if len(invoice.pos_order_ids) > 0 else False
