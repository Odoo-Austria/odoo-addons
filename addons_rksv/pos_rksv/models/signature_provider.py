# -*- coding: utf-8 -*-

from odoo import models, fields, api, _
import logging

_logger = logging.getLogger(__name__)


class signature_provider(models.Model):
    _name = "signature.provider"
    _description = "Signature Providers"
    _order = 'name'
    _inherit = ['mail.thread']

    name = fields.Char(string='Signature Name')
    serial = fields.Char(string='Serial')
    reader = fields.Char(string='Reader')
    valid_from = fields.Date(string='Valid From')
    valid_until = fields.Date(string='Valid Until')
    public_key = fields.Char(string='Public Key')
    provider_name = fields.Char(string='Provider Name')
    issuer = fields.Char(string='Issuer')
    subject = fields.Char(string='Subject')
    x509 = fields.Text(string='X509')
    pos_config_id = fields.Many2one(
        comodel_name='pos.config',
        string='Point of Sale'
    )
    bmf_last_status = fields.Selection(
        selection=[
            ('UNBEKANNT', 'Unbekannt'),
            ('IN_BETRIEB', 'In Betrieb'),
            ('AUSFALL', 'Ausfall'),
        ],
        string="Status",
        readonly=True,
        default='UNBEKANNT',
        track_visibility='onchange',
        copy=False
    )
    bmf_last_update = fields.Datetime(
        string='Letztes Update vom BMF',
        copy=False)
    bmf_message = fields.Char(
        string="BMF Status Text",
        track_visibility='onchange',
        copy=False
    )

    @api.model
    def set_providers(self, providers, pos_config_id):
        _logger.debug("Providers: %r", providers)
        _logger.debug("POS Config: %r", pos_config_id)
        for provider in providers:
            existing_provider = self.env['signature.provider'].search([('public_key', '=', provider['cin'])])
            vals = {
                'public_key': provider['cin'],
                'reader': provider['reader'],
                'subject': provider['subject'],
                'serial': provider['serial'],
                'valid_from': provider['valid_from'],
                'valid_until': provider['valid_until'],
                'x509': provider['x509'],
                'name': provider['cin'],
                'pos_config_id': pos_config_id['pos_config_id'],
            }
            if existing_provider:
                existing_provider.write(vals)
            else:
                self.env['signature.provider'].create(vals)

    @api.model
    def update_status(self, signaturedata):
        _logger.debug("Got data to update: %r", signaturedata)
        signature = self.search([('serial', '=', signaturedata['serial'])], limit=1)
        vals = {}
        vals['bmf_last_status'] = signaturedata['bmf_last_status'] if 'bmf_last_status' in signaturedata else 'UNBEKANNT'
        vals['bmf_last_update'] = signaturedata['bmf_last_update'] if 'bmf_last_update' in signaturedata else None
        vals['bmf_message'] = signaturedata['bmf_message'] if 'bmf_message' in signaturedata else ''
        signature.write(vals)

        return True
