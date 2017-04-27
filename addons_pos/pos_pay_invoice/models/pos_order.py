# -*- coding: utf-8 -*-

from openerp import models, fields, api, _
import logging

_logger = logging.getLogger(__name__)


class PosOrderLine(models.Model):
    _inherit = "pos.order.line"

    invoice_id = fields.Many2one('account.invoice', string='Invoice', readonly=True)

    @api.model
    def create(self, vals):
        line = super(PosOrderLine, self).create(vals)
        if 'invoice_id' in vals:
            line.order_id.write({
                'invoice_id': vals.get('invoice_id'),
            })
        return line


class PosOrder(models.Model):
    _inherit = "pos.order"

    invoice_id = fields.Many2one('account.invoice', string='Invoice', readonly=True)

    @api.multi
    def action_pos_order_paid(self):
        res = super(PosOrder, self).action_pos_order_paid()
        if self.invoice_id:
            self.state = 'invoiced'
        return res
