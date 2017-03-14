# -*- coding: utf-8 -*-

from openerp import models, fields, api, _
import logging

_logger = logging.getLogger(__name__)


class PosOrder(models.Model):
    _inherit = 'pos.order'

    def _payment_fields(self, cr, uid, ui_paymentline, context=None):
        values = super(PosOrder, self)._payment_fields(cr, uid, ui_paymentline, context)
        _logger.info("got payment line values %r", ui_paymentline)
        values['six_ref_number'] = (ui_paymentline['ref_number'] if 'ref_number' in ui_paymentline else None)
        values['six_receipt'] = (ui_paymentline['receipt'] if 'receipt' in ui_paymentline else None)
        values['six_receipt_html'] = (ui_paymentline['receipt_html'] if 'receipt_html' in ui_paymentline else None)
        values['six_receipt_merchant'] = (ui_paymentline['receipt_merchant'] if 'receipt_merchant' in ui_paymentline else None)
        values['six_receipt_merchant_html'] = (ui_paymentline['receipt_merchant_html'] if 'receipt_merchant_html' in ui_paymentline else None)
        return values

    def add_payment(self, cr, uid, order_id, data, context=None):
        _logger.info("add payment got called with data %r", data)
        orig_payment_name = None
        if 'six_ref_number' in data and data['six_ref_number'] > '':
            orig_payment_name = (data['payment_name'] if 'payment_name' in data else None)
            data['payment_name'] = data['six_ref_number']
        statement_id = super(PosOrder, self).add_payment(cr, uid, order_id, data, context)
        # Here do update the statement - include six data
        if 'six_ref_number' in data and data['six_ref_number'] > '':
            order = self.browse(cr, uid, order_id, context=context)
            name = order.name + ': ' + (data.get('payment_name', '') or '')
            statement_line_obj = self.pool.get('account.bank.statement.line')
            line_statement_id = statement_line_obj.search(cr, uid, [('name', '=', name),('statement_id','=',statement_id)])
            # do write six ref number - and bring back old name
            statement_line_obj.write(cr, uid, line_statement_id, {
                'six_ref_number': data['six_ref_number'],
                'six_receipt': data['six_receipt'],
                'six_receipt_html': data['six_receipt_html'],
                'six_receipt_merchant': data['six_receipt_merchant'],
                'six_receipt_merchant_html': data['six_receipt_merchant_html'],
                'name': order.name + ': ' + (orig_payment_name or ''),
            })
        return statement_id