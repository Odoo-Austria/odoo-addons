# -*- coding: utf-8 -*-

from openerp import models, fields, api, _
import logging

_logger = logging.getLogger(__name__)


class POSOrder(models.Model):
    _name = 'pos.order'
    _inherit = 'pos.order'

    ocr_code_value = fields.Text(string="OCR Code Value", readonly=True)
    qr_code_value = fields.Text(string="QR Code Value", readonly=True)
    cashbox_mode = fields.Selection([
        ('active', 'Normal'),
        ('signature_failed', 'Signatureinheit Ausgefallen'),
        ('posbox_failed', 'PosBox Ausgefallen')
    ], string="Signatur Modus", readonly=True)
    qr_code_image = fields.Binary(string="QR Code", attachment=True, readonly=True)
    receipt_id = fields.Integer(string='Receipt ID', readonly=True)
    typeOfReceipt = fields.Selection([
        ('STANDARD_BELEG', 'Normaler Beleg'),
        ('START_BELEG', 'Start Beleg'),
        ('STORNO_BELEG', 'Storno Beleg'),
        ('TRAINING_BELEG', 'Trainingsbeleg'),
        ('NULL_BELEG', 'Null Beleg'),
        ('NONE_BELEG', 'Kein Beleg'),
    ], string="Belegart")
    signatureSerial = fields.Char("Signatur Seriennummer", size=16)
    encryptedTurnOverValue = fields.Char("Summenspeicher codiert", size=128)
    chainValue = fields.Char("Verkettungswert", size=128)
    signedJWSCompactRep = fields.Char("JWS", size=256)
    taxSetNormal = fields.Integer("20% in Cent")
    taxSetErmaessigt1 = fields.Integer("10% in Cent")
    taxSetErmaessigt2 = fields.Integer("13% in Cent")
    taxSetNull = fields.Integer("0% in Cent")
    taxSetBesonders = fields.Integer("19% in Cent")
    turnOverValue = fields.Integer("Summenspeicher")

    def test_paid(self):
        """A Point of Sale is paid when the sum
        @return: True
        """
        self.ensure_one()
        res = super(POSOrder, self).test_paid()
        if not self.lines:
            res = True
        return res

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
        order_values['typeOfReceipt'] = ui_order['typeOfReceipt'] if 'typeOfReceipt' in ui_order else None
        order_values['signatureSerial'] = ui_order['signatureSerial'] if 'signatureSerial' in ui_order else None
        order_values['encryptedTurnOverValue'] = ui_order['encryptedTurnOverValue'] if 'encryptedTurnOverValue' in ui_order else None
        order_values['chainValue'] = ui_order['chainValue'] if 'chainValue' in ui_order else None
        order_values['signedJWSCompactRep'] = ui_order['signedJWSCompactRep'] if 'signedJWSCompactRep' in ui_order else None
        order_values['taxSetNormal'] = ui_order['taxSetNormal'] if 'taxSetNormal' in ui_order else None
        order_values['taxSetErmaessigt1'] = ui_order['taxSetErmaessigt1'] if 'taxSetErmaessigt1' in ui_order else None
        order_values['taxSetErmaessigt2'] = ui_order['taxSetErmaessigt2'] if 'taxSetErmaessigt2' in ui_order else None
        order_values['taxSetNull'] = ui_order['taxSetNull'] if 'taxSetNull' in ui_order else None
        order_values['taxSetBesonders'] = ui_order['taxSetBesonders'] if 'taxSetBesonders' in ui_order else None
        order_values['turnOverValue'] = ui_order['turnOverValue'] if 'turnOverValue' in ui_order else None
        return order_values
