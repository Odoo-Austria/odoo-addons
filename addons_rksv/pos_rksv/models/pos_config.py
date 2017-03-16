# -*- coding: utf-8 -*-

from odoo import models, fields, api, _
from odoo.exceptions import UserError
import urllib2
import logging
import uuid
try:
    import simplejson as json
except ImportError:
    import json

_logger = logging.getLogger(__name__)


class pos_config(models.Model):
    _name = 'pos.config'
    _inherit = 'pos.config'

    @api.multi
    def _calc_cashregisterid(self):
        for config in self:
            _logger.info('do generate new uuid1 based uuid')
            if not config.cashregisterid or config.cashregisterid == '':
                config.cashregisterid = uuid.uuid1()

    # NOT YET USED
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
    iface_rksv = fields.Boolean(string='RKSV', help="Use PosBox for RKSV")
    bound_signature = fields.Boolean(string='Bound')
    pos_admin_passwd = fields.Char(string='POS Admin Password')
    bmf_gemeldet = fields.Boolean(string='Registrierkasse beim BMF angemeldet')
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
        domain=[('sale_ok', '=', True), ('available_in_pos', '=', True)],
        required=True
    )
    month_product_id = fields.Many2one(
        comodel_name='product.product',
        string='Monatsbeleg (Produkt)',
        domain=[('sale_ok', '=', True), ('available_in_pos', '=', True)],
        required=True
    )
    year_product_id = fields.Many2one(
        comodel_name='product.product',
        string='Jahresbeleg (Produkt)',
        domain=[('sale_ok', '=', True), ('available_in_pos', '=', True)],
        required=True
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

    @api.multi
    def button_detect_signature_providers(self):
        if (self.proxy_ip is False) or (self.proxy_ip == ''):
            raise UserError(_('Missing Proxy IP\n\nPlease provide ip address of hardware proxy !'))
        url = 'http://%s/hw_proxy/cashbox/providers/' % (self.proxy_ip,)
        _logger.info('Do search for signature providers on %s', url)
        request_data = json.dumps({'dummy': True})
        req = urllib2.Request(url, request_data, {'Content-Type': 'application/json'})
        response_data = json.load(urllib2.urlopen(req))
        _logger.info('got data %r', response_data)
        if 'result' not in response_data:
            raise UserError(_('Proxy failed\n\nHardware proxy did failed to get list of signature providers'))
        for provider in response_data['result']:
            if not provider:
                continue
            _logger.debug('got provider %r', provider)
            _logger.info('do search for existing provider with serial=%s', provider['serial'])
            sprovider = self.env['signature.provider'].search([('serial', '=', provider['serial'])], limit=1)
            if len(sprovider) > 0:
                _logger.info('found registered signature provider - skip it')
                continue
            new_provider = {
                'state': 'new',
                'serial': provider['serial'],
                'name': '%s, Serial: %s' % (provider['reader'], provider['cin'],),
                'valid_until': provider['valid_until'],
                'valid_from': provider['valid_from'],
                'issuer': provider['issuer'],
                'subject': provider['subject'],
                'x509': provider['x509'],
                'pos_config_id': self.id,
            }
            self.env['signature.provider'].create(new_provider)
