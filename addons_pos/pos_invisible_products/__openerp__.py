# -*- coding: utf-8 -*-
{
    'name': 'POS Invisible Products',
    'version': '8.0.0.1',
    'category': 'Point of Sale',
    'sequence': 6,
    'summary': 'Products can be set invisible while still be loaded to POS properly.',
    'website': 'https://www.callino.at/',
    'description': """
POS Money InOut
===============

Products can be set invisible while still be loaded to POS properly
""",
    'author': 'Gerhard Baumgartner (Callino)',
    'depends': ['point_of_sale', 'pos_compat'],
    'test': [
    ],
    'data': [
        'views/templates.xml',
        'views/product.xml',
        # 'views/pos_order.xml',
    ],
    'installable': True,
    'auto_install': False,
    "external_dependencies": {
        "python": [],
        "bin": []
    },
}
