# -*- coding: utf-8 -*-
{
    'name': 'POS Auto Reconcile',
    'version': '8.0.0.1',
    'category': 'Point of Sale',
    'sequence': 6,
    'summary': 'Reconciliation is done automatically if possible during the closing of a PoS session.',
    'website': 'https://www.callino.at/',
    'description': """
POS Money InOut
===============

Reconciliation is done automatically if possible during the closing of a PoS session.
""",
    'author': 'Gerhard Baumgartner (Callino)',
    'depends': ['point_of_sale'],
    'test': [
    ],
    'data': [
    ],
    'installable': True,
    'auto_install': False,
    "external_dependencies": {
        "python": [],
        "bin": []
    },
}
