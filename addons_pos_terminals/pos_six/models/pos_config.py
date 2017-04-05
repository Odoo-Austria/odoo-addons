# -*- coding: utf-8 -*-

from openerp import models, fields, api, _
import logging

_logger = logging.getLogger(__name__)


class pos_config(models.Model):
    _name = 'pos.config'
    _inherit = 'pos.config'

    auto_terminal_shift = fields.Boolean(string="Automatische Schicht", default=True)
