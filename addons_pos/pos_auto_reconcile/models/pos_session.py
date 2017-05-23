# -*- coding: utf-8 -*-

from openerp import models, fields, api, _
import logging

_logger = logging.getLogger(__name__)


class POSSession(models.Model):
    _name = 'pos.session'
    _inherit = 'pos.session'

    def wkf_action_close(self, cr, uid, ids, context=None):
        po_obj = self.pool['pos.order']
        aml_obj = self.pool['account.move.line']

        # Call regular workflow
        res = super(POSSession, self).wkf_action_close(
            cr, uid, ids, context=context)

        # Get All Pos Order invoiced during the current Sessions
        po_ids = po_obj.search(cr, uid, [
            ('session_id', 'in', ids),
            ('invoice_id', '!=', False),
        ], context=context)
        for po in po_obj.browse(cr, uid, po_ids, context=context):
            # We're searching only account Invoices that has been payed
            # In Point Of Sale
            # if not po.invoice_id.forbid_payment:
            #    continue

            # Search all move Line to reconcile in Sale Journal
            aml_sale_ids = []
            aml_sale_total = 0
            for aml in po.invoice_id.move_id.line_id:
                if (aml.partner_id.id == po.partner_id.id and
                            aml.account_id.type == 'receivable'):
                    aml_sale_ids.append(aml.id)
                    aml_sale_total += aml.debit - aml.credit

            aml_payment_ids = []
            aml_payment_total = 0
            # Search all move Line to reconcile in Payment Journals
            abs_ids = list(set([x.statement_id.id for x in po.statement_ids]))
            aml_ids = aml_obj.search(cr, uid, [
                ('statement_id', 'in', abs_ids),
                ('partner_id', '=', po.partner_id.id),
                ('reconcile_id', '=', False)], context=context)
            for aml in aml_obj.browse(
                    cr, uid, aml_ids, context=context):
                if (aml.account_id.type == 'receivable'):
                    aml_payment_ids.append(aml.id)
                    aml_payment_total += aml.debit - aml.credit

            # Try to reconcile
            if aml_payment_total != - aml_sale_total:
                # Unable to reconcile
                _logger.warning(
                    "Unable to reconcile the payment of %s #%s."
                    "(partner : %s)" % (
                        po.name, po.id, po.partner_id.name))
            else:
                aml_obj.reconcile(
                    cr, uid, aml_payment_ids + aml_sale_ids, 'manual',
                    False, False, False, context=context)

        return res
