# -*- coding: utf-8 -*-

from openerp import models, fields, api, _


class pos_config(models.Model):
    _name = 'pos.config'
    _inherit = 'pos.config'
    default_table_id = fields.Many2one(
        comodel_name='restaurant.table',
        string='Standard Tisch',
        required=True
    )
