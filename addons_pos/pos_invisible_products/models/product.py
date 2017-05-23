# -*- coding: utf-8 -*-

from openerp import models, fields, api, _
import logging

_logger = logging.getLogger(__name__)


class ProductTemplate(models.Model):
    _inherit = 'product.template'

    pos_product_invisible = fields.Boolean('Nicht sichtbar am POS', default=False)
