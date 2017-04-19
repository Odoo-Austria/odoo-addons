# -*- coding: utf-8 -*-
{
    'name': 'PoS Pay Invoice',
    'version': '1.0',
    'category': 'Point of Sale',
    'sequence': 6,
    'summary': 'Pay open invoice directly in PoS session',
    'website': 'https://github.com/Odoo-Austria',
    'author': 'WT-IO-IT GmbH, Wolfgang Taferner, Wolfgang Pichler (Callino)',
    'license': "AGPL-3",
    'description': """
PoS Pay Invoice
================

Pay invoice directly on in PoS session
""",
    'depends': ['point_of_sale', 'pos_product_reference'],
    'test': [
    ],
    'data': [
        'views/templates.xml',
        'views/pos_config.xml',
        'views/pos_order.xml',
    ],
    'qweb': [
        'static/src/xml/invoice.xml'
    ],
    'installable': True,
    'auto_install': False,
    "external_dependencies": {
        "python": [],
        "bin": []
    },
}
