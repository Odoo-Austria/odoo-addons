# -*- coding: utf-8 -*-
{
    'name': 'POS compatibility layer',
    'version': '8.0.0.1',
    'category': 'Point of Sale',
    'sequence': 6,
    'summary': 'Backport of some core POS functions from version 9+',
    'website': 'https://www.callino.at/',
    'description': """
POS compatibility
=================

""",
    'author': 'Wolfgang Pichler (Callino)',
    'depends': ['point_of_sale', 'pos_product_reference'],
    'test': [
    ],
    'data': [
        'views/templates.xml',
    ],
    'qweb': [
    ],
    'installable': True,
    'auto_install': False,
    "external_dependencies": {
        "python": [],
        "bin": []
    },
}
