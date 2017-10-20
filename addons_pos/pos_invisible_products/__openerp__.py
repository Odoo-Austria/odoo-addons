# -*- coding: utf-8 -*-
{
    'name': 'POS Invisible Products',
    'version': '9.0.0.1',
    'category': 'Point of Sale',
    'sequence': 6,
    'summary': 'Products can be set invisible while still be loaded to PoS properly.',
    'author': 'Gerhard Baumgartner (Callino), WT-IO-IT GmbH, Wolfgang Taferner',
    'website': 'https://github.com/Odoo-Austria/odoo-addons',
    'description': """
PoS Invisible Products
========================

Products can be set invisible while still be loaded to PoS properly
""",
    'depends': ['point_of_sale'],
    'test': [
    ],
    'data': [
        'views/templates.xml',
        'views/product.xml',
    ],
    'installable': True,
    'auto_install': False,
    "external_dependencies": {
        "python": [],
        "bin": []
    },
}
