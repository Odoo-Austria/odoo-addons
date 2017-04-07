# -*- coding: utf-8 -*-
{
    'name': 'POS Pay Invoice',
    'version': '1.0',
    'category': 'Point of Sale',
    'sequence': 6,
    'summary': 'Pay invoice directly on in pos session',
    'website': 'https://www.callino.at/',
    'description': """
POS Pay Invoice
===============

Pay invoice directly on in pos session
""",
    'author': 'Wolfgang Pichler (Callino)',
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
