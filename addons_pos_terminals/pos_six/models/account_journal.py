# -*- coding: utf-8 -*-

from odoo import models, fields, api, _


class AccountJournal(models.Model):
    _inherit = 'account.journal'

    is_sixx_terminal = fields.Boolean('Sixx Terminal', default=False)
    sixx_terminal_id = fields.Char('Terminal ID')
    open_cashdrawer = fields.Boolean('Open Cashdrawer', default=False)
    auto_validate = fields.Boolean('Auto Validate', default=False)
