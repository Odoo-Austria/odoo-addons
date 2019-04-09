# -*- coding: utf-8 -*-

from odoo import models, fields, api, _
from odoo.exceptions import UserError
import pytz
from datetime import datetime
import base64
import logging
import uuid
try:
    import simplejson as json
except ImportError:
    import json

_logger = logging.getLogger(__name__)


class POSConfig(models.Model):
    _inherit = 'pos.config'

    @api.multi
    def action_dep_export(self):
        if not self.env.user._is_superuser():
            raise UserError('This feature is not yet available for everyone. Please contact your Odoo superadmin to fulfill this task.')
            return
        for config in self:
            DEP_EXPORT = {
                'Belege-Gruppe': []
            }
            receipts_all = config.mapped('session_ids').mapped('order_ids')
            receipts = receipts_all.filtered(lambda r: r.signedJWSCompactRep).sorted(key=lambda r: r.receipt_id)
            _logger.warning('There are %s receipts which are not signed or out of bounce', len(receipts_all) - len(receipts))

            sorted_receipts = {}
            last_id = False
            for receipt in receipts:
                if last_id and receipt.receipt_id != (last_id + 1):
                    _logger.warning('There is a receipt missing with receipt id %s', (last_id + 1))
                signature = self.env['signature.provider'].search([
                    ('serial', '=', int(receipt.signatureSerial, 16))
                ])
                last_id = receipt.receipt_id

                if signature not in sorted_receipts:
                    sorted_receipts[signature] = []
                sorted_receipts[signature].append(receipt.signedJWSCompactRep)

            public_key = ''
            provider_keys = []
            for signature, receipts_compact in sorted_receipts.items():
                DEP_EXPORT['Belege-Gruppe'].append({
                    'Signaturzertifikat': public_key,
                    'Zertifizierungsstellen': provider_keys,
                    'Belege-Kompakt': receipts_compact,
                })

            utc_now = datetime.now()
            datas = base64.encodestring(json.dumps(DEP_EXPORT))
            datas_fname = '%s_%s_DEP_EXPORT.dep' % (utc_now.strftime('%Y-%m-%d'), config.cashregisterid)

            # Attachment for Report
            attach_vals = {
                'name': datas_fname,
                'datas': datas,
                'type': 'binary',
                'datas_fname': datas_fname,
                'res_model': self._name,
                'res_id': self.id,
            }

            attachments = config.env['ir.attachment'].with_context(
                default_msg='',
                default_datas=datas,
                default_datas_fname=datas_fname
            ).search([
                ('res_model', '=', config._name),
                ('res_id', '=', config.id)
            ])
            if attachments:
                attachments.write(attach_vals)
            else:
                attachments.create(attach_vals)

    @api.multi
    def open_ui(self):
        for config in self:
            if not self.iface_rksv:
                # Do not check for rksv products if rksv is not activated for this pos.config
                continue
            if not (
                config.start_product_id.rksv_tax_mapping_correct and
                config.year_product_id.rksv_tax_mapping_correct and
                config.month_product_id.rksv_tax_mapping_correct and
                config.null_product_id.rksv_tax_mapping_correct and
                config.invoice_product_id.rksv_tax_mapping_correct
            ):
                raise UserError("All configuration products must be correctly configured before opening a PoS Session!")
        return super(POSConfig, self).open_ui()

    @api.multi
    def _calc_cashregisterid(self):
        for config in self:
            _logger.info('do generate new uuid1 based uuid')
            if not config.cashregisterid or config.cashregisterid == '':
                config.cashregisterid = uuid.uuid1()

    @api.model
    def sync_jws(self, jws_sync, config_id):
        success = True
        message = 'All receipts in the Posbox are properly synchronized with your Odoo instance!'
        for signatureSerial, jws_dict in jws_sync.iteritems():
            for receipt_id, jws_value in jws_dict.iteritems():
                order = self.env['pos.order'].search([
                    ('config_id', '=', config_id),
                    ('signatureSerial', '=', signatureSerial),
                    ('receipt_id', '=', receipt_id)
                ])
                if order and order.signedJWSCompactRep in jws_value:
                    order.signedJWSCompactRep = jws_value

                else:
                    success = False
                    message = 'JWS could not be synced! Inconsistency predicted.'
                    _logger.error('JWS could not be synced! Inconsistency predicted.')
        return {
            'success': success,
            'message': message
        }

    @api.model
    def set_provider(self, serial, pos_config_id):
        sprovider = self.env['signature.provider'].search([('serial', '=', serial)])
        config = self.search([('id', '=', pos_config_id)])
        if not config:
            return {'success': False, 'message': "Invalid POS config."}
        if sprovider:
            config.signature_provider_id = sprovider.id
            return {'success': True, 'message': "Signature Provider set."}
        else:
            return {'success': False, 'message': "Invalid POS config or Signature Provider."}

    cashregisterid = fields.Char(
        string='KassenID', size=36,
        compute='_calc_cashregisterid',
        store=True, readonly=True,
        copy=False
    )
    signature_provider_id = fields.Many2one(
        comodel_name='signature.provider',
        string='Signature Provider',
        readonly=True
    )
    available_signature_provider_ids = fields.One2many(
        comodel_name='signature.provider',
        inverse_name='pos_config_id',
        string='Available Providers'
    )
    iface_rksv = fields.Boolean(string='RKSV', default=True, help="Use PosBox for RKSV")
    bound_signature = fields.Boolean(string='Bound')
    pos_admin_passwd = fields.Char(string='POS Admin Password')
    bmf_gemeldet = fields.Boolean(string='Registrierkasse beim BMF angemeldet')
    rksv_at = fields.Boolean('RKSV AT', related='company_id.rksv_at')
    bmf_test_mode = fields.Boolean(
        string='BMF Test Modus',
        default=True
    )
    # Overwrite state field - instead of using our own field
    state = fields.Selection(
        string='State',
        selection=[
            ('inactive', 'Inactive'),
            ('setup', 'Setup'),
            ('active', 'Active'),
            ('failure', 'Fehler'),
            ('signature_failed', 'Fehler Signatureinheit'),
            ('posbox_failed', 'Fehler PosBox')
        ],
        default='setup',
        required=True,
        readonly=True,
        copy=False
    )

    start_product_id = fields.Many2one(
        comodel_name='product.product',
        string='Startbeleg (Produkt)',
        domain=[
            ('sale_ok', '=', True),
            ('available_in_pos', '=', True),
            ('rksv_tax_mapping_correct', '=', True),
            ('rksv_product_type', '=', 'startreceipt'),
        ],
        required=False,
    )
    month_product_id = fields.Many2one(
        comodel_name='product.product',
        string='Monatsbeleg (Produkt)',
        domain=[
            ('sale_ok', '=', True),
            ('available_in_pos', '=', True),
            ('rksv_tax_mapping_correct', '=', True),
            ('rksv_product_type', '=', 'monthreceipt'),
        ],
        required=False,
    )
    year_product_id = fields.Many2one(
        comodel_name='product.product',
        string='Jahresbeleg (Produkt)',
        domain=[
            ('sale_ok', '=', True),
            ('available_in_pos', '=', True),
            ('rksv_tax_mapping_correct', '=', True),
            ('rksv_product_type', '=', 'yearreceipt'),
        ],
        required=False,
    )
    null_product_id = fields.Many2one(
        comodel_name='product.product',
        string='Nullbeleg (Produkt)',
        domain=[
            ('sale_ok', '=', True),
            ('available_in_pos', '=', True),
            ('rksv_tax_mapping_correct', '=', True),
            ('rksv_product_type', '=', 'nullreceipt'),
        ],
        required=False,
    )
    invoice_product_id = fields.Many2one(
        comodel_name='product.product',
        string='Invoice (Product)',
        domain=[
            ('sale_ok', '=', True),
            ('available_in_pos', '=', True),
            ('rksv_tax_mapping_correct', '=', True),
            ('rksv_product_type', '=', 'nullreceipt')
        ],
        required=False,
    )
    _sql_constraints = [('cashregisterid_unique', 'unique(cashregisterid)', 'Cashregister ID must be unique.')]

    @api.model
    def cashbox_registered_with_bmf(self, config_id):
        pos_config = self.env['pos.config'].search([('id', '=', config_id)])
        if pos_config:
            pos_config.write({'bmf_gemeldet': True})
            return True
        else:
            return False

    @api.multi
    def create_cashregisterid(self):
        self._calc_cashregisterid()

    @api.multi
    def set_failure(self):
        self.state = 'posbox_failed'

    @api.multi
    def set_active(self):
        self.state = 'active'
        # Do generate a cashregisterid if there is not id attached already
        self._calc_cashregisterid()
