# -*- coding: utf-8 -*-

from odoo import fields, models
import logging

_logger = logging.getLogger(__name__)


class AccountInvoice(models.Model):
    _inherit = 'account.invoice'

    qr_code_image = fields.Binary(
        string="QR Code",
        compute='_retrieve_pos_data',
        attachment=True, readonly=True
    )

    def _retrieve_pos_data(self):
        super(AccountInvoice, self)._retrieve_pos_data()
        for invoice in self:
            pos_order = invoice.pos_order_id
            invoice.qr_code_image = pos_order and pos_order.qr_code_image or False
