# -*- coding: utf-8 -*-

from odoo import models, fields, api, _
import logging

_logger = logging.getLogger(__name__)


class POSOrder(models.Model):
    _name = 'pos.order'
    _inherit = 'pos.order'

    ocr_code_value = fields.Text(string="OCR Code Value", readonly=True)
    qr_code_value = fields.Text(string="QR Code Value", readonly=True)
    receipt_id = fields.Integer(string='Receipt ID', readonly=True)
    cashbox_mode = fields.Selection([
        ('active', 'Normal'),
        ('signature_failed', 'Signatureinheit Ausgefallen'),
        ('posbox_failed', 'PosBox Ausgefallen')
    ], string="Signatur Modus", readonly=True)
    qr_code_image = fields.Binary(string="QR Code", attachment=True, readonly=True)

    @api.model
    def _order_fields(self, ui_order):
        '''
        We do extend the order fields here to also store our rksv data !
        '''
        order_values = super(POSOrder, self)._order_fields(ui_order)
        order_values['ocr_code_value'] = ui_order['ocrcodevalue'] if 'ocrcodevalue' in ui_order else None
        order_values['qr_code_value'] = ui_order['qrcodevalue'] if 'qrcodevalue' in ui_order else None
        order_values['receipt_id'] = ui_order['receipt_id'] if 'receipt_id' in ui_order else None
        order_values['qr_code_image'] = ui_order['qrcode_img'].split(",")[1] if 'qrcode_img' in ui_order and ui_order['qrcode_img'] else None
        order_values['cashbox_mode'] = ui_order['cashbox_mode'] if 'cashbox_mode' in ui_order else None
        return order_values
