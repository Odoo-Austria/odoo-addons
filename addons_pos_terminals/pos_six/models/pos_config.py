# -*- coding: utf-8 -*-

from odoo import models, fields, api, _


class pos_config(models.Model):
    _name = 'pos.config'
    _inherit = 'pos.config'

    auto_terminal_shift = fields.Boolean(string="Automatische Schicht", default=True)
